import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class FavorisService {
  private readonly logger = new Logger(FavorisService.name);

  constructor(private prisma: PrismaService) {}

  async toggle(userId: string, articleId: string) {
    const existing = await this.prisma.favori.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });

    if (existing) {
      // Unfavori
      await this.prisma.favori.delete({ where: { id: existing.id } });
      return { favori: false, message: 'Retiré des favoris' };
    } else {
      // Favori
      await this.prisma.favori.create({ data: { userId, articleId } });
      return { favori: true, message: 'Ajouté aux favoris' };
    }
  }

  async findByUser(userId: string) {
    const favoris = await this.prisma.favori.findMany({
      where: { userId },
      orderBy: { dateCreation: 'desc' },
      include: {
        article: {
          include: {
            vendeur: {
              select: { id: true, nom: true, avatar: true, ville: true, noteMoyenne: true },
            },
          },
        },
      },
    });

    return favoris.map((f) => ({
      ...f.article,
      favori: true,
      dateFavori: f.dateCreation,
    }));
  }

  async isFavori(userId: string, articleId: string): Promise<boolean> {
    const existing = await this.prisma.favori.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });
    return !!existing;
  }
}
