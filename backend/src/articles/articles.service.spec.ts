import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();

    // Créer des vendeurs activés (frais de 1 000 FCFA payés)
    await prisma.user.create({
      data: { id: 'vendeur-1', phone: '+2250001', nom: 'Vendeur', role: 'SELLER', sellerFeePaid: true },
    });
    await prisma.user.create({
      data: { id: 'vendeur-2', phone: '+2250002', nom: 'Autre Vendeur', role: 'SELLER', sellerFeePaid: true },
    });

    // Un acheteur (rôle BUYER) et un vendeur non payé pour les tests de rejet
    await prisma.user.create({
      data: { id: 'acheteur-1', phone: '+2250003', nom: 'Acheteur', role: 'BUYER', sellerFeePaid: false },
    });
    await prisma.user.create({
      data: { id: 'vendeur-non-paye', phone: '+2250004', nom: 'Vendeur Non Payé', role: 'SELLER', sellerFeePaid: false },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  // ─── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      titre: 'iPhone 15 Pro',
      description: 'Excellent état',
      categorie: 'ELECTRONIQUE' as any,
      etat: 'COMME_NEUF' as any,
      prix: 500000,
      ville: 'Abidjan',
      photos: ['https://example.com/photo.jpg'],
    };

    it('devrait créer un article avec toutes les infos', async () => {
      const article = await service.create('vendeur-1', validDto);

      expect(article).toHaveProperty('id');
      expect(article.titre).toBe('iPhone 15 Pro');
      expect(article.vendeurId).toBe('vendeur-1');
      expect(article.statut).toBeUndefined(); // Pas de statut par défaut dans le mock
      expect(article.photos).toEqual(['https://example.com/photo.jpg']);
    });

    it('devrait créer un article sans photos', async () => {
      const { photos: _photos, ...dtoSansPhotos } = validDto;
      const article = await service.create('vendeur-1', dtoSansPhotos);

      expect(article.photos).toEqual([]);
    });

    it('devrait inclure le vendeurId dans la réponse', async () => {
      const article = await service.create('vendeur-1', validDto);

      expect(article.vendeurId).toBe('vendeur-1');
    });

    it('devrait refuser la publication si le compte est un acheteur (BUYER)', async () => {
      await expect(
        service.create('acheteur-1', validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devrait refuser la publication si les frais vendeur ne sont pas payés', async () => {
      await expect(
        service.create('vendeur-non-paye', validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devrait refuser si le compte vendeur n\'existe pas', async () => {
      await expect(
        service.create('inconnu', validDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    beforeEach(async () => {
      await prisma.article.create({
        data: {
          id: 'article-1',
          vendeurId: 'vendeur-1',
      titre: 'iPhone 15 Pro',
      description: 'Smartphone Apple',
      categorie: 'ELECTRONIQUE',
      etat: 'COMME_NEUF' as any,
      prix: 500000,
      statut: 'EN_LIGNE',
      ville: 'Abidjan',
        },
      });
      await prisma.article.create({
        data: {
          id: 'article-2',
          vendeurId: 'vendeur-1',
      titre: 'Canapé 3 places',
      description: 'Canapé confortable',
      categorie: 'MAISON',
      etat: 'BON' as any,
      prix: 150000,
      statut: 'EN_LIGNE',
      ville: 'Dakar',
        },
      });
      await prisma.article.create({
        data: {
          id: 'article-3',
          vendeurId: 'vendeur-1',
      titre: 'Article vendu',
      description: 'Déjà vendu',
      categorie: 'ELECTRONIQUE',
      etat: 'NEUF' as any,
      prix: 10000,
      statut: 'VENDU',
        },
      });
    });

    it('devrait retourner uniquement les articles EN_LIGNE', async () => {
      const articles = await service.findAll();
      expect(articles).toHaveLength(2);
      expect(articles.every((a: any) => a.statut === 'EN_LIGNE')).toBe(true);
    });

    it('devrait filtrer par catégorie', async () => {
      const articles = await service.findAll({ categorie: 'MAISON' });
      expect(articles).toHaveLength(1);
      expect(articles[0].titre).toBe('Canapé 3 places');
    });

    it('devrait rechercher par texte (titre ou description)', async () => {
      const articles = await service.findAll({ q: 'iPhone' });
      expect(articles).toHaveLength(1);
      expect(articles[0].titre).toContain('iPhone');
    });

    it('devrait filtrer par fourchette de prix', async () => {
      const articles = await service.findAll({ prixMin: 100000, prixMax: 200000 });
      expect(articles).toHaveLength(1);
      expect(articles[0].prix).toBe(150000);
    });

    it('devrait filtrer par ville', async () => {
      const articles = await service.findAll({ ville: 'Dakar' });
      expect(articles).toHaveLength(1);
      expect(articles[0].ville).toContain('Dakar');
    });

    it('devrait retourner un tableau vide si aucun résultat', async () => {
      const articles = await service.findAll({ categorie: 'MODE' as any });
      expect(articles).toHaveLength(0);
    });
  });

  // ─── findById ───────────────────────────────────────────────────────────

  describe('findById', () => {
    beforeEach(async () => {
      await prisma.article.create({
        data: {
          id: 'article-1',
          vendeurId: 'vendeur-1',      titre: 'iPhone 15 Pro',
      description: 'Smartphone Apple',
      categorie: 'ELECTRONIQUE',
      etat: 'COMME_NEUF' as any,
      prix: 500000,
      statut: 'EN_LIGNE',
        },
      });
    });

    it('devrait retourner un article par son ID', async () => {
      const article = await service.findById('article-1');
      expect(article).toHaveProperty('id', 'article-1');
      expect(article.titre).toBe('iPhone 15 Pro');
      expect(article.vendeur).toHaveProperty('nom', 'Vendeur');
    });

    it('devrait lever une erreur si article introuvable', async () => {
      await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────

  describe('update', () => {
    beforeEach(async () => {
      await prisma.article.create({
        data: {
          id: 'article-1',
          vendeurId: 'vendeur-1',      titre: 'iPhone 15 Pro',
      description: 'Excellent état',
      categorie: 'ELECTRONIQUE',
      etat: 'COMME_NEUF' as any,
      prix: 500000,
      statut: 'EN_LIGNE',
        },
      });
    });

    it('devrait mettre à jour le titre', async () => {
      const updated = await service.update('article-1', 'vendeur-1', {
        titre: 'iPhone 15 Pro Max',
        prix: 600000,
      });
      expect(updated.titre).toBe('iPhone 15 Pro Max');
      expect(updated.prix).toBe(600000);
    });

    it('devrait lever une erreur si article introuvable', async () => {
      await expect(
        service.update('invalid', 'vendeur-1', { titre: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("devrait lever une erreur si ce n'est pas le vendeur", async () => {
      await expect(
        service.update('article-1', 'vendeur-2', { titre: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────

  describe('delete', () => {
    beforeEach(async () => {
      await prisma.article.create({
        data: {
          id: 'article-1',
          vendeurId: 'vendeur-1',
          titre: 'iPhone 15 Pro',
          description: 'Excellent état',
          categorie: 'ELECTRONIQUE',
          etat: 'COMME_NEUF',
          prix: 500000,
          statut: 'EN_LIGNE',
        },
      });
    });

    it('devrait supprimer un article', async () => {
      const result = await service.delete('article-1', 'vendeur-1');
      expect(result).toEqual({ message: 'Article supprimé' });

      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article).toBeNull();
    });

    it('devrait lever une erreur si article introuvable', async () => {
      await expect(service.delete('invalid', 'vendeur-1')).rejects.toThrow(NotFoundException);
    });

    it("devrait lever une erreur si ce n'est pas le vendeur", async () => {
      await expect(
        service.delete('article-1', 'vendeur-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── markAsSold ─────────────────────────────────────────────────────────

  describe('markAsSold', () => {
    beforeEach(async () => {
      await prisma.article.create({
        data: {
          id: 'article-1',
          vendeurId: 'vendeur-1',
          titre: 'iPhone 15 Pro',
          description: 'Excellent état',
          categorie: 'ELECTRONIQUE',
          etat: 'COMME_NEUF' as any,
          prix: 500000,
          statut: 'EN_LIGNE',
        },
      });
    });

    it('devrait marquer un article comme vendu', async () => {
      const updated = await service.markAsSold('article-1', 'vendeur-1');
      expect(updated.statut).toBe('VENDU');
    });

    it('devrait lever une erreur si article introuvable', async () => {
      await expect(service.markAsSold('invalid', 'vendeur-1')).rejects.toThrow(NotFoundException);
    });

    it("devrait lever une erreur si ce n'est pas le vendeur", async () => {
      await expect(
        service.markAsSold('article-1', 'vendeur-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
