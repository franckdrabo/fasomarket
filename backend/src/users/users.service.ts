import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        avatar: true,
        ville: true,
        bio: true,
        noteMoyenne: true,
        nbVentes: true,
        nbAchats: true,
        badgeVerifie: true,
        dateCreation: true,
      },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        avatar: true,
        ville: true,
        noteMoyenne: true,
        nbVentes: true,
        badgeVerifie: true,
        dateCreation: true,
      },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async getArticlesByUser(userId: string, statut?: string) {
    const where: any = { vendeurId: userId };
    if (statut) where.statut = statut;

    return this.prisma.article.findMany({
      where,
      orderBy: { dateCreation: 'desc' },
    });
  }

  async getAvisRecus(userId: string) {
    return this.prisma.avis.findMany({
      where: { cibleId: userId },
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
