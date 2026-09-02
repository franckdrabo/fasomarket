import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: MockPrismaService;

  const mockNotificationsService = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();
    jest.clearAllMocks();

    // Créer des données de test
    await prisma.user.create({
      data: { id: 'vendeur-1', phone: '+2250001', nom: 'Vendeur' },
    });
    await prisma.user.create({
      data: { id: 'acheteur-1', phone: '+2250002', nom: 'Acheteur' },
    });
    await prisma.article.create({
      data: {
        id: 'article-1',
        vendeurId: 'vendeur-1',
        titre: 'Article test',
        description: 'Description',
        categorie: 'ELECTRONIQUE',
        etat: 'NEUF',
        prix: 50000,
        statut: 'EN_LIGNE',
      },
    });
    await prisma.conversation.create({
      data: {
        id: 'conv-1',
        articleId: 'article-1',
        acheteurId: 'acheteur-1',
        vendeurId: 'vendeur-1',
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  // ─── initiatePayment ────────────────────────────────────────────────────

  describe('initiatePayment', () => {
    const validDto = {
      articleId: 'article-1',
      conversationId: 'conv-1',
      montant: 50000,
      moyenPaiement: 'ORANGE_MONEY' as const,
    };

    it('devrait créer une transaction en escrow', async () => {
      const result = await service.initiatePayment('acheteur-1', validDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('statutEscrow', 'EN_ATTENTE');
      expect(result).toHaveProperty('fraisService', 2500); // 5% de 50000
      expect(result.acheteurId).toBe('acheteur-1');
      expect(result.vendeurId).toBe('vendeur-1');

      // Vérifier que l'article est réservé
      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article?.statut).toBe('RESERVE');

      // Vérifier que la notification a été envoyée
      expect(mockNotificationsService.sendToUser).toHaveBeenCalledWith(
        'vendeur-1',
        expect.objectContaining({ title: expect.stringContaining('Paiement') }),
      );
    });

    it('devrait lever une erreur si article introuvable', async () => {
      await expect(
        service.initiatePayment('acheteur-1', { ...validDto, articleId: 'invalid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait lever une erreur si l\'acheteur est aussi le vendeur', async () => {
      await expect(
        service.initiatePayment('vendeur-1', validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devrait lever une erreur si l\'article n\'est pas disponible', async () => {
      await prisma.article.update({
        where: { id: 'article-1' },
        data: { statut: 'VENDU' },
      });

      await expect(
        service.initiatePayment('acheteur-1', validDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait lever une erreur si conversation invalide', async () => {
      await expect(
        service.initiatePayment('acheteur-1', { ...validDto, conversationId: 'invalid' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── confirmPayment ─────────────────────────────────────────────────────

  describe('confirmPayment', () => {
    beforeEach(async () => {
      await prisma.transaction.create({
        data: {
          id: 'tx-1',
          articleId: 'article-1',
          acheteurId: 'acheteur-1',
          vendeurId: 'vendeur-1',
          montant: 50000,
          fraisService: 2500,
          moyenPaiement: 'ORANGE_MONEY',
          statutEscrow: 'EN_ATTENTE',
        },
      });
    });

    it('devrait confirmer le paiement et passer le statut à BLOQUE', async () => {
      const result = await service.confirmPayment('tx-1', 'REF-123');

      expect(result).toHaveProperty('statutEscrow', 'BLOQUE');
      expect(result).toHaveProperty('referencePaiement', 'REF-123');
    });
  });

  // ─── confirmReception ──────────────────────────────────────────────────

  describe('confirmReception', () => {
    beforeEach(async () => {
      await prisma.transaction.create({
        data: {
          id: 'tx-1',
          articleId: 'article-1',
          acheteurId: 'acheteur-1',
          vendeurId: 'vendeur-1',
          montant: 50000,
          fraisService: 2500,
          moyenPaiement: 'ORANGE_MONEY',
          statutEscrow: 'BLOQUE',
        },
      });
    });

    it('devrait libérer les fonds et marquer l\'article comme vendu', async () => {
      const result = await service.confirmReception('acheteur-1', { transactionId: 'tx-1' });

      expect(result.statutEscrow).toBe('LIBERE');
      expect(result).toHaveProperty('dateValidation');

      // Vérifier que l'article est marqué vendu
      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article?.statut).toBe('VENDU');

      // Vérifier les notifications
      expect(mockNotificationsService.sendToUser).toHaveBeenCalledWith(
        'vendeur-1',
        expect.objectContaining({ title: expect.stringContaining('Vente confirmée') }),
      );
    });

    it('devrait lever une erreur si ce n\'est pas l\'acheteur', async () => {
      await expect(
        service.confirmReception('vendeur-1', { transactionId: 'tx-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('devrait lever une erreur si la transaction n\'est pas BLOQUE', async () => {
      await prisma.transaction.update({
        where: { id: 'tx-1' },
        data: { statutEscrow: 'EN_ATTENTE' },
      });

      await expect(
        service.confirmReception('acheteur-1', { transactionId: 'tx-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── openDispute ───────────────────────────────────────────────────────

  describe('openDispute', () => {
    beforeEach(async () => {
      await prisma.transaction.create({
        data: {
          id: 'tx-1',
          articleId: 'article-1',
          acheteurId: 'acheteur-1',
          vendeurId: 'vendeur-1',
          montant: 50000,
          fraisService: 2500,
          moyenPaiement: 'ORANGE_MONEY',
          statutEscrow: 'BLOQUE',
        },
      });
    });

    it('devrait ouvrir un litige', async () => {
      const result = await service.openDispute('acheteur-1', {
        transactionId: 'tx-1',
        motif: 'Article non conforme à la description',
      });

      expect(result.statutEscrow).toBe('LITIGE');
      expect(result.motifLitige).toBe('Article non conforme à la description');

      // Vérifier les notifications aux deux parties
      expect(mockNotificationsService.sendToUsers).toHaveBeenCalled();
    });

    it('devrait lever une erreur si la transaction n\'est pas en BLOQUE', async () => {
      await prisma.transaction.update({
        where: { id: 'tx-1' },
        data: { statutEscrow: 'LIBERE' },
      });

      await expect(
        service.openDispute('acheteur-1', { transactionId: 'tx-1', motif: 'Problème' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait permettre au vendeur aussi d\'ouvrir un litige', async () => {
      const result = await service.openDispute('vendeur-1', {
        transactionId: 'tx-1',
        motif: 'Acheteur non coopératif',
      });

      expect(result.statutEscrow).toBe('LITIGE');
    });

    it('devrait lever une erreur pour un utilisateur non concerné', async () => {
      await prisma.user.create({
        data: { id: 'autre', phone: '+2250003', nom: 'Autre' },
      });

      await expect(
        service.openDispute('autre', { transactionId: 'tx-1', motif: 'Problème' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findByUser ────────────────────────────────────────────────────────

  describe('findByUser', () => {
    beforeEach(async () => {
      await prisma.transaction.create({
        data: {
          id: 'tx-1',
          articleId: 'article-1',
          acheteurId: 'acheteur-1',
          vendeurId: 'vendeur-1',
          montant: 50000,
          fraisService: 2500,
          moyenPaiement: 'ORANGE_MONEY',
          statutEscrow: 'BLOQUE',
        },
      });
    });

    it('devrait retourner les transactions d\'un utilisateur', async () => {
      const result = await service.findByUser('acheteur-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].acheteurId).toBe('acheteur-1');
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(1);
    });

    it('devrait retourner un tableau vide si aucune transaction', async () => {
      const result = await service.findByUser('user-inexistant');
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────

  describe('findById', () => {
    beforeEach(async () => {
      await prisma.transaction.create({
        data: {
          id: 'tx-1',
          articleId: 'article-1',
          acheteurId: 'acheteur-1',
          vendeurId: 'vendeur-1',
          montant: 50000,
          fraisService: 2500,
          moyenPaiement: 'ORANGE_MONEY',
          statutEscrow: 'BLOQUE',
        },
      });
    });

    it('devrait retourner une transaction par son ID', async () => {
      const result = await service.findById('tx-1');
      expect(result).toHaveProperty('id', 'tx-1');
      expect(result).toHaveProperty('montant', 50000);
    });

    it('devrait lever une erreur si transaction introuvable', async () => {
      await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
