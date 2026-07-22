import { Test, TestingModule } from '@nestjs/testing';
import { FavorisService } from './favoris.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('FavorisService', () => {
  let service: FavorisService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();

    // Créer les données de base
    await prisma.user.create({ data: { id: 'user-1', phone: '+2250001', nom: 'Alice', ville: 'Abidjan' } });
    await prisma.user.create({ data: { id: 'user-2', phone: '+2250002', nom: 'Bob', ville: 'Dakar' } });

    await prisma.article.create({
      data: {
        id: 'article-1',
        vendeurId: 'user-2',
        titre: 'iPhone 15 Pro',
        description: 'Smartphone',
        categorie: 'ELECTRONIQUE',
        etat: 'COMME_NEUF',
        prix: 500000,
        statut: 'EN_LIGNE',
      },
    });
    await prisma.article.create({
      data: {
        id: 'article-2',
        vendeurId: 'user-2',
        titre: 'Canapé 3 places',
        description: 'Confortable',
        categorie: 'MAISON',
        etat: 'BON',
        prix: 150000,
        statut: 'EN_LIGNE',
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavorisService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FavorisService>(FavorisService);
  });

  // ─── toggle ─────────────────────────────────────────────────────────────

  describe('toggle', () => {
    it('devrait ajouter un favori', async () => {
      const result = await service.toggle('user-1', 'article-1');

      expect(result).toEqual({ favori: true, message: 'Ajouté aux favoris' });

      const isFav = await service.isFavori('user-1', 'article-1');
      expect(isFav).toBe(true);
    });

    it('devrait retirer un favori existant', async () => {
      await service.toggle('user-1', 'article-1');
      const result = await service.toggle('user-1', 'article-1');

      expect(result).toEqual({ favori: false, message: 'Retiré des favoris' });

      const isFav = await service.isFavori('user-1', 'article-1');
      expect(isFav).toBe(false);
    });

    it('devrait gérer les favoris indépendants par utilisateur', async () => {
      await service.toggle('user-1', 'article-1');
      await service.toggle('user-2', 'article-1');

      expect(await service.isFavori('user-1', 'article-1')).toBe(true);
      expect(await service.isFavori('user-2', 'article-1')).toBe(true);

      await service.toggle('user-1', 'article-1');
      expect(await service.isFavori('user-1', 'article-1')).toBe(false);
      expect(await service.isFavori('user-2', 'article-1')).toBe(true);
    });

    it('devrait gérer plusieurs favoris pour un même utilisateur', async () => {
      await service.toggle('user-1', 'article-1');
      await service.toggle('user-1', 'article-2');

      expect(await service.isFavori('user-1', 'article-1')).toBe(true);
      expect(await service.isFavori('user-1', 'article-2')).toBe(true);
    });
  });

  // ─── findByUser ─────────────────────────────────────────────────────────

  describe('findByUser', () => {
    beforeEach(async () => {
      await prisma.favori.create({
        data: { userId: 'user-1', articleId: 'article-1', dateCreation: new Date('2024-01-01') },
      });
      await prisma.favori.create({
        data: { userId: 'user-1', articleId: 'article-2', dateCreation: new Date('2024-06-15') },
      });
    });

    it("devrait retourner les articles favoris d'un utilisateur", async () => {
      const favoris = await service.findByUser('user-1');

      expect(favoris).toHaveLength(2);
      expect(favoris[0]).toHaveProperty('favori', true);
      expect(favoris[0]).toHaveProperty('dateFavori');
      expect(favoris[0].titre).toBeDefined();
    });

    it('devrait inclure les infos du vendeur', async () => {
      const favoris = await service.findByUser('user-1');

      expect(favoris[0].vendeur).toHaveProperty('nom', 'Bob');
      expect(favoris[0].vendeur).toHaveProperty('ville');
    });

    it('devrait retourner un tableau vide si aucun favori', async () => {
      const favoris = await service.findByUser('user-2');
      expect(favoris).toHaveLength(0);
    });

    it("devrait retourner les favoris par date décroissante", async () => {
      const favoris = await service.findByUser('user-1');
      expect(favoris).toHaveLength(2);
      // Le plus récent en premier (juin > janvier)
      expect(favoris[0].id).toBe('article-2');
      expect(favoris[1].id).toBe('article-1');
    });
  });

  // ─── isFavori ───────────────────────────────────────────────────────────

  describe('isFavori', () => {
    it('devrait retourner false si pas favori', async () => {
      const result = await service.isFavori('user-1', 'article-1');
      expect(result).toBe(false);
    });

    it('devrait retourner true si favori', async () => {
      await service.toggle('user-1', 'article-1');
      const result = await service.isFavori('user-1', 'article-1');
      expect(result).toBe(true);
    });

    it('devrait retourner false pour un autre utilisateur', async () => {
      await service.toggle('user-1', 'article-1');
      const result = await service.isFavori('user-2', 'article-1');
      expect(result).toBe(false);
    });
  });
});
