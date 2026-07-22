import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Ajouter un FCM token pour un utilisateur
  async addFcmToken(userId: string, token: string) {
    const user = await this.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const tokens = user.fcmTokens || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
      await this.user.update({
        where: { id: userId },
        data: { fcmTokens: tokens },
      });
    }
  }

  // Supprimer un FCM token (déconnexion)
  async removeFcmToken(userId: string, token: string) {
    const user = await this.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const tokens = (user.fcmTokens || []).filter((t) => t !== token);
    await this.user.update({
      where: { id: userId },
      data: { fcmTokens: tokens },
    });
  }
}
