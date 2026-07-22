import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MobileMoneyFactory } from './mobile-money.service';
import { MobileMoneyPaymentDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private mobileMoneyFactory: MobileMoneyFactory,
    private notificationsService: NotificationsService,
  ) {}

  async initiateMobileMoneyPayment(userId: string, dto: MobileMoneyPaymentDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: {
        article: { select: { titre: true, vendeurId: true } },
        acheteur: { select: { id: true, nom: true, phone: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaction introuvable');
    if (transaction.acheteurId !== userId) throw new BadRequestException('Action non autorisée');
    if (transaction.statutEscrow !== 'EN_ATTENTE') throw new BadRequestException('Transaction déjà traitée');

    // Récupérer le provider mobile money
    const provider = this.mobileMoneyFactory.getProvider(dto.moyenPaiement);

    // Initier le paiement via l'API du provider
    const result = await provider.initiatePayment({
      montant: transaction.montant,
      telephone: dto.telephone,
      reference: transaction.referencePaiement || transaction.id,
      description: `Paiement ${transaction.article.titre.substring(0, 50)} - Bazario`,
    });

    if (!result.success) {
      throw new BadRequestException(`Échec du paiement ${provider.name}: ${result.message}`);
    }

    // Mettre à jour la transaction avec la référence provider
    await this.prisma.transaction.update({
      where: { id: dto.transactionId },
      data: {
        referencePaiement: result.providerReference,
        // Le statut reste EN_ATTENTE jusqu'au callback/confirmation
      },
    });

    // Envoyer une notification à l'acheteur
    await this.notificationsService.sendToUser(userId, {
      title: `💳 Paiement ${provider.name} initié`,
      body: `Votre paiement de ${transaction.montant.toLocaleString()} FCFA est en cours de traitement via ${provider.name}.\n✅ Confirmez le paiement sur votre téléphone.`,
      data: {
        type: 'payment_initiated',
        transactionId: transaction.id,
        provider: provider.name,
      },
    });

    this.logger.log(`💰 Paiement ${provider.name} initié: ${result.providerReference}`);

    return {
      message: `💰 Paiement ${provider.name} initié. Confirmez sur votre téléphone.`,
      providerReference: result.providerReference,
      provider: provider.name,
      transactionId: transaction.id,
    };
  }

  async handleProviderCallback(provider: string, payload: any) {
    const providerService = this.mobileMoneyFactory.getProvider(provider.toUpperCase());
    const callbackData = await providerService.processCallback(payload);

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { referencePaiement: callbackData.reference },
          { id: callbackData.reference },
        ],
      },
      include: {
        article: { select: { titre: true, vendeurId: true } },
        acheteur: { select: { id: true, nom: true } },
        vendeur: { select: { id: true, nom: true } },
      },
    });

    if (!transaction) {
      this.logger.warn(`⚠️ Transaction non trouvée pour le callback: ${callbackData.reference}`);
      return { received: true };
    }

    if (callbackData.status === 'SUCCESS') {
      // Paiement confirmé → bloquer les fonds en escrow
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          statutEscrow: 'BLOQUE',
          referencePaiement: callbackData.providerReference,
        },
      });

      // Marquer l'article comme réservé
      await this.prisma.article.update({
        where: { id: transaction.articleId },
        data: { statut: 'RESERVE' },
      });

      // Message système dans la conversation
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          articleId: transaction.articleId,
          acheteurId: transaction.acheteurId,
        },
      });

      if (conversation) {
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            expediteurId: transaction.acheteurId,
            contenu: `✅ Paiement confirmé ! ${transaction.montant.toLocaleString()} FCFA sécurisés en escrow. Transaction #${callbackData.providerReference}`,
            type: 'SYSTEME',
          },
        });
      }

      // Notifications
      await this.notificationsService.sendToUser(transaction.vendeurId, {
        title: '💰 Paiement confirmé',
        body: `${transaction.montant.toLocaleString()} FCFA bloqués en escrow pour "${transaction.article.titre.substring(0, 50)}" par ${transaction.acheteur.nom}`,
        data: {
          type: 'payment_confirmed',
          transactionId: transaction.id,
          articleId: transaction.articleId,
        },
      });

      await this.notificationsService.sendToUser(transaction.acheteurId, {
        title: '✅ Paiement confirmé',
        body: `Votre paiement de ${transaction.montant.toLocaleString()} FCFA est sécurisé en escrow. Le vendeur va préparer votre commande.`,
        data: {
          type: 'payment_confirmed_buyer',
          transactionId: transaction.id,
        },
      });

      this.logger.log(`✅ Paiement confirmé pour ${transaction.id}: ${callbackData.providerReference}`);
    } else {
      // Paiement échoué
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { statutEscrow: 'REMBOURSE' },
      });

      await this.notificationsService.sendToUser(transaction.acheteurId, {
        title: '❌ Paiement échoué',
        body: `Le paiement de ${transaction.montant.toLocaleString()} FCFA via ${provider} a échoué. Veuillez réessayer avec un autre moyen de paiement.`,
        data: {
          type: 'payment_failed',
          transactionId: transaction.id,
        },
      });
    }

    return { received: true };
  }

  async getStatus(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        montant: true,
        statutEscrow: true,
        moyenPaiement: true,
        referencePaiement: true,
        dateCreation: true,
        dateValidation: true,
      },
    });

    if (!transaction) throw new NotFoundException('Transaction introuvable');
    return transaction;
  }

  async getAdminStats(periode: string = '30j') {
    const jours = periode === '7j' ? 7 : periode === '90j' ? 90 : periode === '1an' ? 365 : 30;
    const since = new Date();
    since.setDate(since.getDate() - jours);

    const [transactions, revenu, parMoyen, volume] = await Promise.all([
      this.prisma.transaction.count({ where: { dateCreation: { gte: since } } }),
      this.prisma.transaction.aggregate({
        where: { statutEscrow: 'LIBERE', dateCreation: { gte: since } },
        _sum: { montant: true, fraisService: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['moyenPaiement'],
        where: { dateCreation: { gte: since } },
        _count: { id: true },
        _sum: { montant: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['statutEscrow'],
        where: { dateCreation: { gte: since } },
        _count: { id: true },
      }),
    ]);

    return {
      periode: `${jours}j`,
      totalTransactions: transactions,
      revenuTotal: revenu._sum.montant || 0,
      fraisServiceTotal: revenu._sum.fraisService || 0,
      repartitionMoyenPaiement: parMoyen.map((m) => ({
        moyen: m.moyenPaiement,
        count: m._count.id,
        montant: m._sum.montant || 0,
      })),
      repartitionStatut: volume.map((v) => ({
        statut: v.statutEscrow,
        count: v._count.id,
      })),
    };
  }
}
