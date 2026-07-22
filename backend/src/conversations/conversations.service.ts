import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async create(articleId: string, acheteurId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article introuvable');
    if (article.vendeurId === acheteurId) {
      throw new ForbiddenException('Vous ne pouvez pas chatter avec vous-même');
    }

    // Vérifier si une conversation existe déjà
    const existing = await this.prisma.conversation.findFirst({
      where: { articleId, acheteurId },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        articleId,
        acheteurId,
        vendeurId: article.vendeurId,
      },
      include: {
        article: { select: { id: true, titre: true, prix: true, photos: true } },
        acheteur: { select: { id: true, nom: true, avatar: true } },
        vendeur: { select: { id: true, nom: true, avatar: true } },
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [{ acheteurId: userId }, { vendeurId: userId }],
      },
      include: {
        article: { select: { id: true, titre: true, prix: true, photos: true } },
        acheteur: { select: { id: true, nom: true, avatar: true } },
        vendeur: { select: { id: true, nom: true, avatar: true } },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        article: { select: { id: true, titre: true, prix: true, photos: true, statut: true, vendeurId: true } },
        acheteur: { select: { id: true, nom: true, avatar: true } },
        vendeur: { select: { id: true, nom: true, avatar: true } },
        messages: {
          orderBy: { timestamp: 'asc' },
          include: {
            expediteur: { select: { id: true, nom: true, avatar: true } },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation introuvable');
    if (conversation.acheteurId !== userId && conversation.vendeurId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    // Marquer les messages comme lus
    await this.prisma.message.updateMany({
      where: {
        conversationId: id,
        expediteurId: { not: userId },
        lu: false,
      },
      data: { lu: true },
    });

    return conversation;
  }
}
