import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InitiatePaymentDto, ConfirmReceptionDto, OpenDisputeDto } from './transactions.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async initiatePayment(acheteurId: string, dto: InitiatePaymentDto) {
    const article = await this.prisma.article.findUnique({ where: { id: dto.articleId } });
    if (!article) throw new NotFoundException('Article introuvable');
    if (article.vendeurId === acheteurId) throw new ForbiddenException('Action non autorisée');
    if (article.statut !== 'EN_LIGNE') throw new BadRequestException('Article non disponible');

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });
    if (!conversation || conversation.acheteurId !== acheteurId) {
      throw new ForbiddenException('Conversation invalide');
    }

    // Vérifier qu'il n'y a pas déjà une transaction active
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: {
        articleId: dto.articleId,
        acheteurId,
        statutEscrow: { in: ['EN_ATTENTE', 'BLOQUE'] },
      },
    });
    if (existingTransaction) throw new BadRequestException('Une transaction est déjà en cours');

    // Créer la transaction en escrow
    const commissionBazario = Math.round(dto.montant * 0.005 * 100) / 100; // 0.5% commission Bazario
    const fraisService = Math.round(dto.montant * 0.05 * 100) / 100; // 5% frais opérateur
    const dateLimite = new Date();
    dateLimite.setDate(dateLimite.getDate() + 14); // Libération auto après 14 jours

    const transaction = await this.prisma.transaction.create({
      data: {
        articleId: dto.articleId,
        acheteurId,
        vendeurId: article.vendeurId,
        montant: dto.montant,
        commissionBazario,
        fraisService,
        moyenPaiement: dto.moyenPaiement,
        statutEscrow: 'EN_ATTENTE',
        dateLimite,
        referencePaiement: `BAZ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      },
    });

    // Marquer l'article comme réservé
    await this.prisma.article.update({
      where: { id: dto.articleId },
      data: { statut: 'RESERVE' },
    });

    // Envoyer un message système dans la conversation
    await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        expediteurId: acheteurId,
        contenu: `💳 Paiement de ${dto.montant.toLocaleString()} FCFA initié via ${dto.moyenPaiement}. Transaction #${transaction.referencePaiement}`,
        type: 'SYSTEME',
      },
    });

    // Notification push au vendeur
    await this.notificationsService.sendToUser(article.vendeurId, {
      title: '💳 Paiement reçu',
      body: `${dto.montant.toLocaleString()} FCFA bloqués en escrow pour "${article.titre.substring(0, 50)}"`,
      data: {
        type: 'payment_received',
        transactionId: transaction.id,
        articleId: dto.articleId,
      },
    });

    return transaction;
  }

  async confirmPayment(transactionId: string, reference: string) {
    this.logger.log(`💰 Paiement confirmé pour la transaction ${transactionId}, référence: ${reference}`);
    const transaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        statutEscrow: 'BLOQUE',
        referencePaiement: reference,
      },
      include: {
        article: { select: { titre: true } },
        acheteur: { select: { nom: true } },
        vendeur: { select: { nom: true } },
      },
    });

    return transaction;
  }

  async confirmReception(acheteurId: string, dto: ConfirmReceptionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: { article: true },
    });

    if (!transaction) throw new NotFoundException('Transaction introuvable');
    if (transaction.acheteurId !== acheteurId) throw new ForbiddenException('Action non autorisée');
    if (transaction.statutEscrow !== 'BLOQUE') throw new BadRequestException('Transaction non concernée');

    // Libérer les fonds vers le vendeur
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: dto.transactionId },
      data: {
        statutEscrow: 'LIBERE',
        dateValidation: new Date(),
      },
    });

    // Marquer l'article comme vendu
    await this.prisma.article.update({
      where: { id: transaction.articleId },
      data: {
        statut: 'VENDU',
      },
    });

    // Mettre à jour les stats
    await this.prisma.user.update({
      where: { id: transaction.vendeurId },
      data: { nbVentes: { increment: 1 } },
    });
    await this.prisma.user.update({
      where: { id: transaction.acheteurId },
      data: { nbAchats: { increment: 1 } },
    });

    // Notification push au vendeur
    await this.notificationsService.sendToUser(transaction.vendeurId, {
      title: '✅ Vente confirmée',
      body: `Fonds libérés ! ${transaction.montant.toLocaleString()} FCFA débloqués pour "${transaction.article.titre.substring(0, 50)}"`,
      data: {
        type: 'payment_released',
        transactionId: transaction.id,
      },
    });

    return updatedTransaction;
  }

  async openDispute(userId: string, dto: OpenDisputeDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
    });

    if (!transaction) throw new NotFoundException('Transaction introuvable');
    if (transaction.acheteurId !== userId && transaction.vendeurId !== userId) {
      throw new ForbiddenException('Action non autorisée');
    }
    if (transaction.statutEscrow !== 'BLOQUE') throw new BadRequestException('Litige non possible');

    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: dto.transactionId },
      data: {
        statutEscrow: 'LITIGE',
        motifLitige: dto.motif,
      },
    });

    // Notification au vendeur et à l'acheteur
    await this.notificationsService.sendToUsers(
      [transaction.acheteurId, transaction.vendeurId],
      {
        title: '⚠️ Litige ouvert',
        body: `Un litige a été ouvert pour la transaction #${transaction.referencePaiement || dto.transactionId.substring(0, 8)}. L'équipe Bazario va traiter le dossier.`,
        data: {
          type: 'dispute_opened',
          transactionId: transaction.id,
        },
      },
    );

    return updatedTransaction;
  }

  async findByUser(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          OR: [{ acheteurId: userId }, { vendeurId: userId }],
        },
        include: {
          article: { select: { id: true, titre: true, photos: true, prix: true } },
          acheteur: { select: { id: true, nom: true, avatar: true } },
          vendeur: { select: { id: true, nom: true, avatar: true } },
        },
        orderBy: { dateCreation: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({
        where: {
          OR: [{ acheteurId: userId }, { vendeurId: userId }],
        },
      }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        article: { select: { id: true, titre: true, photos: true, prix: true } },
        acheteur: { select: { id: true, nom: true, avatar: true } },
        vendeur: { select: { id: true, nom: true, avatar: true } },
        avis: true,
      },
    });

    if (!transaction) throw new NotFoundException('Transaction introuvable');
    return transaction;
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async resolveDispute(transactionId: string, action: 'LIBERE' | 'REMBOURSE') {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { article: true },
    });

    if (!transaction) throw new NotFoundException('Transaction introuvable');
    if (transaction.statutEscrow !== 'LITIGE') {
      throw new BadRequestException('La transaction n\'est pas en litige');
    }

    if (action === 'LIBERE') {
      // Libérer les fonds vers le vendeur
      const updated = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          statutEscrow: 'LIBERE',
          dateValidation: new Date(),
        },
      });

      await this.prisma.article.update({
        where: { id: transaction.articleId },
        data: { statut: 'VENDU' },
      });

      await this.prisma.user.update({
        where: { id: transaction.vendeurId },
        data: { nbVentes: { increment: 1 } },
      });
      await this.prisma.user.update({
        where: { id: transaction.acheteurId },
        data: { nbAchats: { increment: 1 } },
      });

      await this.notificationsService.sendToUsers(
        [transaction.acheteurId, transaction.vendeurId],
        {
          title: '✅ Litige résolu — Fonds libérés',
          body: `Le litige a été résolu en faveur du vendeur. ${transaction.montant.toLocaleString()} FCFA ont été libérés.`,
          data: {
            type: 'dispute_resolved',
            transactionId,
            resolution: 'LIBERE',
          },
        },
      );

      return updated;
    } else {
      // Rembourser l'acheteur
      const updated = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          statutEscrow: 'REMBOURSE',
          dateValidation: new Date(),
        },
      });

      await this.prisma.article.update({
        where: { id: transaction.articleId },
        data: { statut: 'EN_LIGNE' },
      });

      await this.notificationsService.sendToUsers(
        [transaction.acheteurId, transaction.vendeurId],
        {
          title: '🔄 Litige résolu — Remboursement',
          body: `Le litige a été résolu en faveur de l'acheteur. ${transaction.montant.toLocaleString()} FCFA ont été remboursés.`,
          data: {
            type: 'dispute_resolved',
            transactionId,
            resolution: 'REMBOURSE',
          },
        },
      );

      return updated;
    }
  }

  async getDisputes() {
    return this.prisma.transaction.findMany({
      where: { statutEscrow: 'LITIGE' },
      include: {
        article: { select: { id: true, titre: true, photos: true, prix: true } },
        acheteur: { select: { id: true, nom: true, phone: true } },
        vendeur: { select: { id: true, nom: true, phone: true } },
      },
      orderBy: { dateCreation: 'desc' },
    });
  }
}
