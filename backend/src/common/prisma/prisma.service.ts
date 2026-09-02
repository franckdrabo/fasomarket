import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../encryption/encryption.service';
import { createEncryptedPrismaClient, EncryptedPrismaClient } from './prisma-encrypted.extension';

/**
 * Service Prisma avec chiffrement transparent.
 *
 * - `this` = PrismaClient standard (sans chiffrement)
 * - `this.encrypted` = PrismaClient étendu qui chiffre/déchiffre
 *   automatiquement les champs PII (nomEncrypted, emailEncrypted, etc.)
 *
 * Pour les opérations sur User, utilisez `this.prisma.encrypted.user.xxx()`
 * Pour les autres modèles (Article, Conversation, etc.), utilisez directement
 * `this.prisma.article.xxx()` car ils n'ont pas de PII.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Client étendu avec chiffrement transparent pour User */
  encrypted: EncryptedPrismaClient;

  constructor(private encryptionService: EncryptionService) {
    super();

    // Créer l'extension de chiffrement
    this.encrypted = createEncryptedPrismaClient(this, this.encryptionService);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Ajouter un FCM token pour un utilisateur
   */
  async addFcmToken(userId: string, token: string) {
    const user = await this.encrypted.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const tokens = user.fcmTokens || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
      await this.encrypted.user.update({
        where: { id: userId },
        data: { fcmTokens: tokens },
      });
    }
  }

  /**
   * Supprimer un FCM token (déconnexion)
   */
  async removeFcmToken(userId: string, token: string) {
    const user = await this.encrypted.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const tokens = (user.fcmTokens || []).filter((t: string) => t !== token);
    await this.encrypted.user.update({
      where: { id: userId },
      data: { fcmTokens: tokens },
    });
  }
}
