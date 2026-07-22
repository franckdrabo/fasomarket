import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationPayload } from './notifications.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor(private prisma: PrismaService) {
    this.initFirebase();
  }

  private initFirebase() {
    if (getApps().length > 0) {
      this.initialized = true;
      return;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(serviceAccountPath);
        initializeApp({ credential: cert(serviceAccount) });
        this.initialized = true;
        this.logger.log('🔥 Firebase Admin initialized');
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Firebase non configuré: ${error.message}. Les notifications push ne seront pas envoyées.`,
        );
      }
    } else {
      this.logger.warn(
        '⚠️ Firebase non configuré (FIREBASE_SERVICE_ACCOUNT_PATH manquant). Mode démo activé.',
      );
    }
  }

  async sendToUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });

    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      this.logger.debug(`Aucun FCM token pour l'utilisateur ${userId}`);
      // Sauvegarder quand même dans l'historique (même si non envoyé)
      await this.saveToHistory(userId, payload, 'FAILED', undefined, 'Aucun FCM token enregistré');
      return;
    }

    for (const token of user.fcmTokens) {
      await this.sendToDevice(token, payload, userId);
    }
  }

  async sendToDevice(
    token: string,
    payload: NotificationPayload,
    userId?: string,
  ): Promise<void> {
    if (!this.initialized) {
      this.logger.debug(`[MODE DÉMO] Notification à ${token.substring(0, 20)}...:`, payload);
      if (userId) {
        await this.saveToHistory(userId, payload, 'SENT');
      }
      return;
    }

    try {
      const message: Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'bazario_default',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: payload.title,
                body: payload.body,
              },
            },
          },
        },
      };

      const response = await getMessaging().send(message);
      this.logger.debug(`✅ Notification envoyée: ${response}`);

      if (userId) {
        await this.saveToHistory(userId, payload, 'SENT', token);
      }
    } catch (error: any) {
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`🗑️ Token FCM invalide: ${token.substring(0, 20)}...`);
        if (userId) {
          await this.saveToHistory(userId, payload, 'FAILED', token, `Token invalide: ${error.code}`);
        }
      } else {
        this.logger.error(`❌ Erreur envoi notification: ${error.message}`);
        if (userId) {
          await this.saveToHistory(userId, payload, 'FAILED', token, error.message);
        }
      }
    }
  }

  async sendToUsers(
    userIds: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    const uniqueIds = [...new Set(userIds)];
    await Promise.all(
      uniqueIds.map((id) => this.sendToUser(id, payload)),
    );
  }

  // ─── Historique ─────────────────────────────────────────────────────────

  private async saveToHistory(
    userId: string,
    payload: NotificationPayload,
    status: string,
    fcmToken?: string,
    errorMessage?: string,
  ) {
    try {
      await this.prisma.notificationHistory.create({
        data: {
          userId,
          title: payload.title,
          body: payload.body,
          type: payload.data?.type || null,
          data: payload.data || undefined,
          status,
          fcmToken,
          errorMessage,
        },
      });
    } catch (err) {
      this.logger.error(`❌ Erreur sauvegarde historique notification: ${err instanceof Error ? err.message : err}`, err instanceof Error ? err.stack : '');
    }
  }

  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notificationHistory.findMany({
        where: { userId },
        orderBy: { dateCreation: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notificationHistory.count({ where: { userId } }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notificationHistory.count({
      where: { userId, status: 'SENT' },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.prisma.notificationHistory.updateMany({
      where: { id: notificationId, userId },
      data: { status: 'DELIVERED' },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notificationHistory.updateMany({
      where: { userId, status: 'SENT' },
      data: { status: 'DELIVERED' },
    });
  }
}
