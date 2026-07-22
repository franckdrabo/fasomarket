import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateReviewDto } from './reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(auteurId: string, dto: CreateReviewDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
    });

    if (!transaction) throw new NotFoundException('Transaction introuvable');
    if (transaction.acheteurId !== auteurId && transaction.vendeurId !== auteurId) {
      throw new ForbiddenException('Vous ne pouvez pas évaluer cette transaction');
    }
    if (transaction.statutEscrow !== 'LIBERE') {
      throw new BadRequestException('La transaction doit être terminée');
    }

    // Vérifier que l'utilisateur n'a pas déjà donné son avis
    const existingAvis = await this.prisma.avis.findFirst({
      where: { transactionId: dto.transactionId, auteurId },
    });
    if (existingAvis) throw new BadRequestException('Vous avez déjà évalué cette transaction');

    // Déterminer la cible (celui qui reçoit l'avis)
    const cibleId = transaction.acheteurId === auteurId ? transaction.vendeurId : transaction.acheteurId;

    const avis = await this.prisma.avis.create({
      data: {
        transactionId: dto.transactionId,
        auteurId,
        cibleId,
        note: dto.note,
        commentaire: dto.commentaire,
      },
      include: {
        auteur: { select: { id: true, nom: true, avatar: true } },
        cible: { select: { id: true, nom: true } },
      },
    });

    // Mettre à jour la note moyenne de la cible
    const stats = await this.prisma.avis.aggregate({
      where: { cibleId },
      _avg: { note: true },
      _count: { note: true },
    });

    await this.prisma.user.update({
      where: { id: cibleId },
      data: { noteMoyenne: stats._avg.note || 0 },
    });

    return avis;
  }

  async findByUser(cibleId: string) {
    return this.prisma.avis.findMany({
      where: { cibleId },
      include: {
        auteur: { select: { id: true, nom: true, avatar: true } },
        transaction: {
          select: {
            id: true,
            montant: true,
            article: { select: { id: true, titre: true } },
          },
        },
      },
      orderBy: { dateCreation: 'desc' },
    });
  }
}
