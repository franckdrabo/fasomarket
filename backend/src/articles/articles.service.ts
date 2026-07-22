import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateArticleDto, UpdateArticleDto, SearchArticlesDto } from './articles.dto';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  async create(vendeurId: string, dto: CreateArticleDto) {
    return this.prisma.article.create({
      data: {
        ...dto,
        vendeurId,
        photos: dto.photos || [],
      },
      include: {
        vendeur: {
          select: { id: true, nom: true, avatar: true, ville: true },
        },
      },
    });
  }

  async findAll(filters?: SearchArticlesDto) {
    const where: any = { statut: 'EN_LIGNE' };

    if (filters?.q) {
      where.OR = [
        { titre: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    if (filters?.categorie) where.categorie = filters.categorie;
    if (filters?.ville) where.ville = { contains: filters.ville, mode: 'insensitive' };
    if (filters?.etat) where.etat = filters.etat;
    if (filters?.prixMin || filters?.prixMax) {
      where.prix = {};
      if (filters.prixMin) where.prix.gte = filters.prixMin;
      if (filters.prixMax) where.prix.lte = filters.prixMax;
    }

    return this.prisma.article.findMany({
      where,
      orderBy: { dateCreation: 'desc' },
      include: {
        vendeur: {
          select: { id: true, nom: true, avatar: true, ville: true, noteMoyenne: true },
        },
      },
    });
  }

  async findById(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        vendeur: {
          select: { id: true, nom: true, avatar: true, ville: true, noteMoyenne: true, nbVentes: true, badgeVerifie: true },
        },
        transactions: {
          where: { statutEscrow: { in: ['BLOQUE', 'LIBERE'] } },
          select: { id: true, statutEscrow: true },
        },
      },
    });

    if (!article) throw new NotFoundException('Article introuvable');
    return article;
  }

  async update(id: string, userId: string, dto: UpdateArticleDto) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article introuvable');
    if (article.vendeurId !== userId) throw new ForbiddenException('Action non autorisée');

    return this.prisma.article.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article introuvable');
    if (article.vendeurId !== userId) throw new ForbiddenException('Action non autorisée');

    await this.prisma.article.delete({ where: { id } });
    return { message: 'Article supprimé' };
  }

  async markAsSold(id: string, userId: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article introuvable');
    if (article.vendeurId !== userId) throw new ForbiddenException('Action non autorisée');

    return this.prisma.article.update({
      where: { id },
      data: { statut: 'VENDU' },
    });
  }
}
