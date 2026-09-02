import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EscrowSchedulerService {
  private readonly logger = new Logger(EscrowSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Vérifie toutes les heures les transactions dont la date limite est dépassée
   * et qui sont encore en statut BLOQUE.
   * 
   * Scénario : l'acheteur n'a pas confirmé la réception dans les 14 jours →
   * le système libère automatiquement les fonds vers le vendeur.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async releaseExpiredEscrows() {
    this.logger.log('🔍 Vérification des escrows expirés...');

    const now = new Date();

    const expiredTransactions = await this.prisma.transaction.findMany({
      where: {
        statutEscrow: 'BLOQUE',
        dateLimite: { lte: now },
      },
      include: {
        article: { select: { titre: true, vendeurId: true } },
        acheteur: { select: { id: true, nom: true } },
        vendeur: { select: { id: true, nom: true } },
      },
    });

    if (expiredTransactions.length === 0) {
      this.logger.log('✅ Aucun escrow expiré à libérer');
      return;
    }

    this.logger.log(`⚠️  ${expiredTransactions.length} escrow(s) expiré(s) à libérer automatiquement`);

    for (const transaction of expiredTransactions) {
      try {
        // Libérer les fonds vers le vendeur
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            statutEscrow: 'LIBERE',
            dateValidation: now,
          },
        });

        // Marquer l'article comme vendu
        await this.prisma.article.update({
          where: { id: transaction.articleId },
          data: { statut: 'VENDU' },
        });

        // Mettre à jour les statistiques
        await this.prisma.user.update({
          where: { id: transaction.vendeurId },
          data: { nbVentes: { increment: 1 } },
        });
        await this.prisma.user.update({
          where: { id: transaction.acheteurId },
          data: { nbAchats: { increment: 1 } },
        });

        // Notification à l'acheteur
        await this.notificationsService.sendToUser(transaction.acheteurId, {
          title: '⏰ Libération automatique',
          body: `Les fonds de ${transaction.montant.toLocaleString()} FCFA pour "${transaction.article.titre.substring(0, 50)}" ont été automatiquement libérés vers ${transaction.vendeur.nom} (délai de 14 jours écoulé).`,
          data: {
            type: 'payment_released',
            transactionId: transaction.id,
          },
        });

        // Notification au vendeur
        await this.notificationsService.sendToUser(transaction.vendeurId, {
          title: '💰 Fonds libérés (auto)',
          body: `${transaction.montant.toLocaleString()} FCFA débloqués automatiquement pour "${transaction.article.titre.substring(0, 50)}" après expiration du délai.`,
          data: {
            type: 'payment_released',
            transactionId: transaction.id,
          },
        });

        this.logger.log(`✅ Escrow libéré: ${transaction.id} — ${transaction.montant.toLocaleString()} FCFA`);
      } catch (error) {
        this.logger.error(`❌ Erreur libération escrow ${transaction.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`✅ ${expiredTransactions.length} escrow(s) libéré(s) automatiquement`);
  }

  /**
   * Exécutable manuellement via une API (pour admin)
   */
  async runManualRelease() {
    await this.releaseExpiredEscrows();
    return { message: 'Vérification des escrows expirés effectuée' };
  }
}
