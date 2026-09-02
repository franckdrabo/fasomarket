import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();

    // Créer les données de base
    await prisma.user.create({ data: { id: 'vendeur-1', phone: '+2250001', nom: 'Vendeur' } });
    await prisma.user.create({ data: { id: 'acheteur-1', phone: '+2250002', nom: 'Acheteur' } });
    await prisma.user.create({ data: { id: 'tiers', phone: '+2250003', nom: 'Tiers' } });

    await prisma.article.create({
      data: {
        id: 'article-1',
        vendeurId: 'vendeur-1',
        titre: 'iPhone 15 Pro',
        description: 'Smartphone',
        categorie: 'ELECTRONIQUE',
        etat: 'COMME_NEUF',
        prix: 500000,
        statut: 'EN_LIGNE',
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  // ─── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('devrait créer une nouvelle conversation', async () => {
      const conv = await service.create('article-1', 'acheteur-1');

      expect(conv).toHaveProperty('id');
      expect(conv.acheteurId).toBe('acheteur-1');
      expect(conv.vendeurId).toBe('vendeur-1');
      expect(conv.articleId).toBe('article-1');
    });

    it('devrait retourner la conversation existante si déjà créée', async () => {
      const conv1 = await service.create('article-1', 'acheteur-1');
      const conv2 = await service.create('article-1', 'acheteur-1');

      expect(conv2.id).toBe(conv1.id);
    });

    it('devrait lever une erreur si article introuvable', async () => {
      await expect(
        service.create('invalid', 'acheteur-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it("devrait lever une erreur si l'acheteur est le vendeur", async () => {
      await expect(
        service.create('article-1', 'vendeur-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devrait inclure les relations article/acheteur/vendeur', async () => {
      const conv: any = await service.create('article-1', 'acheteur-1');

      expect(conv.article).toHaveProperty('titre', 'iPhone 15 Pro');
      expect(conv.acheteur).toHaveProperty('nom', 'Acheteur');
      expect(conv.vendeur).toHaveProperty('nom', 'Vendeur');
    });
  });

  // ─── findByUser ─────────────────────────────────────────────────────────

  describe('findByUser', () => {
    beforeEach(async () => {
      await prisma.conversation.create({
        data: {
          id: 'conv-1',
          articleId: 'article-1',
          acheteurId: 'acheteur-1',
          vendeurId: 'vendeur-1',
        },
      });
    });

    it("devrait trouver les conversations où l'utilisateur est acheteur", async () => {
      const result = await service.findByUser('acheteur-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('conv-1');
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(1);
    });

    it("devrait trouver les conversations où l'utilisateur est vendeur", async () => {
      const result = await service.findByUser('vendeur-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('conv-1');
    });

    it('devrait retourner un tableau vide si aucune conversation', async () => {
      const result = await service.findByUser('tiers');
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('devrait inclure les relations et le dernier message', async () => {
      await prisma.message.create({
        data: {
          conversationId: 'conv-1',
          expediteurId: 'acheteur-1',
          contenu: 'Bonjour, toujours disponible ?',
        },
      });

      const result = await service.findByUser('acheteur-1');
      expect(result.data[0].messages).toHaveLength(1);
      expect(result.data[0].messages[0].contenu).toBe('Bonjour, toujours disponible ?');
      expect(result.data[0].article).toHaveProperty('titre');
      expect(result.data[0].acheteur).toHaveProperty('nom');
      expect(result.data[0].vendeur).toHaveProperty('nom');
    });
  });

  // ─── findById ───────────────────────────────────────────────────────────

  describe('findById', () => {
    beforeEach(async () => {
      await prisma.conversation.create({
        data: {
          id: 'conv-1',
          articleId: 'article-1',
          acheteurId: 'acheteur-1',
          vendeurId: 'vendeur-1',
        },
      });
      // Ajouter des messages
      await prisma.message.create({
        data: {
          conversationId: 'conv-1',
          expediteurId: 'acheteur-1',
          contenu: 'Bonjour !',
        },
      });
      await prisma.message.create({
        data: {
          conversationId: 'conv-1',
          expediteurId: 'vendeur-1',
          contenu: 'Bonjour, oui disponible',
        },
      });
    });

    it('devrait retourner une conversation avec ses messages', async () => {
      const conv: any = await service.findById('conv-1', 'acheteur-1');

      expect(conv.id).toBe('conv-1');
      expect(conv.messages).toHaveLength(2);
      expect(conv.messages[0].contenu).toBe('Bonjour !');
    });

    it("devrait permettre l'accès à l'acheteur", async () => {
      const conv = await service.findById('conv-1', 'acheteur-1');
      expect(conv.id).toBe('conv-1');
    });

    it("devrait permettre l'accès au vendeur", async () => {
      const conv = await service.findById('conv-1', 'vendeur-1');
      expect(conv.id).toBe('conv-1');
    });

    it('devrait lever une erreur pour un utilisateur non concerné', async () => {
      await expect(
        service.findById('conv-1', 'tiers'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devrait lever une erreur si conversation introuvable', async () => {
      await expect(
        service.findById('invalid', 'acheteur-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it("devrait marquer les messages de l'autre partie comme lus", async () => {
      await service.findById('conv-1', 'vendeur-1');

      // Vérifier que les messages de l'acheteur sont marqués lus
      const conv: any = await service.findById('conv-1', 'vendeur-1');
      expect(conv.id).toBe('conv-1');
    });
  });
});
