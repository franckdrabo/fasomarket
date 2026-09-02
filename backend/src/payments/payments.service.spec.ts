import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { MobileMoneyFactory } from './mobile-money.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('PaymentsService.handleProviderCallback', () => {
  let service: PaymentsService;
  let prisma: MockPrismaService;

  const mockNotificationsService = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
  };

  // Factory mocké : le provider renvoie le statut qu'on lui demande
  const mockFactory = {
    getProvider: jest.fn(),
  };

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();
    jest.clearAllMocks();

    // Données de base
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
        statut: 'RESERVE',
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MobileMoneyFactory, useValue: mockFactory },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  function mockProviderStatus(status: 'SUCCESS' | 'PENDING' | 'FAILED') {
    mockFactory.getProvider.mockReturnValue({
      name: 'CINETPAY',
      initiatePayment: jest.fn(),
      checkStatus: jest.fn(),
      processCallback: jest.fn().mockResolvedValue({
        reference: 'REF-1',
        status,
        providerReference: 'REF-1',
      }),
    });
  }

  // ─── Transaction escrow ────────────────────────────────────────────────

  describe('transaction escrow', () => {
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
          referencePaiement: 'REF-1',
        },
      });
    });

    it('SUCCESS → fonds bloqués en escrow et article réservé', async () => {
      mockProviderStatus('SUCCESS');
      await service.handleProviderCallback('CINETPAY', {});

      const tx = await prisma.transaction.findUnique({ where: { id: 'tx-1' } });
      expect(tx?.statutEscrow).toBe('BLOQUE');

      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article?.statut).toBe('RESERVE');

      expect(mockNotificationsService.sendToUser).toHaveBeenCalledWith(
        'acheteur-1',
        expect.objectContaining({ title: expect.stringContaining('confirmé') }),
      );
    });

    it('FAILED → transaction remboursée ET article remis en ligne (réessai possible)', async () => {
      mockProviderStatus('FAILED');
      await service.handleProviderCallback('CINETPAY', {});

      const tx = await prisma.transaction.findUnique({ where: { id: 'tx-1' } });
      expect(tx?.statutEscrow).toBe('REMBOURSE');

      // Point critique : l'acheteur ne doit pas rester bloqué sur un article RESERVE
      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article?.statut).toBe('EN_LIGNE');

      expect(mockNotificationsService.sendToUser).toHaveBeenCalledWith(
        'acheteur-1',
        expect.objectContaining({ title: expect.stringContaining('échoué') }),
      );
    });

    it('FAILED ne doit pas toucher un article déjà vendu', async () => {
      await prisma.article.update({
        where: { id: 'article-1' },
        data: { statut: 'VENDU' },
      });
      mockProviderStatus('FAILED');
      await service.handleProviderCallback('CINETPAY', {});

      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article?.statut).toBe('VENDU');
    });

    it('FAILED doit être ignoré si la transaction est déjà BLOQUE (fonds en escrow)', async () => {
      await prisma.transaction.update({
        where: { id: 'tx-1' },
        data: { statutEscrow: 'BLOQUE' },
      });
      mockProviderStatus('FAILED');
      await service.handleProviderCallback('CINETPAY', {});

      // Ni la transaction ni l'article ne doivent être dégradés
      const tx = await prisma.transaction.findUnique({ where: { id: 'tx-1' } });
      expect(tx?.statutEscrow).toBe('BLOQUE');
      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article?.statut).toBe('RESERVE');
    });

    it('PENDING → aucune action définitive (statuts inchangés)', async () => {
      mockProviderStatus('PENDING');
      await service.handleProviderCallback('CINETPAY', {});

      const tx = await prisma.transaction.findUnique({ where: { id: 'tx-1' } });
      expect(tx?.statutEscrow).toBe('EN_ATTENTE');

      const article = await prisma.article.findUnique({ where: { id: 'article-1' } });
      expect(article?.statut).toBe('RESERVE');
    });
  });

  // ─── Activation vendeur ────────────────────────────────────────────────

  describe('activation vendeur', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'seller-1',
          phone: '+2250003',
          nom: 'Vendeur à activer',
          role: 'BUYER',
          sellerFeePaid: false,
          sellerFeePending: true,
          sellerFeeRef: 'BAZ-SELLER-1',
        },
      });
    });

    it('SUCCESS → upgrade BUYER → SELLER', async () => {
      mockProviderStatus('SUCCESS');
      mockFactory.getProvider.mockClear();
      mockFactory.getProvider.mockReturnValue({
        name: 'CINETPAY',
        initiatePayment: jest.fn(),
        checkStatus: jest.fn(),
        processCallback: jest.fn().mockResolvedValue({
          reference: 'BAZ-SELLER-1',
          status: 'SUCCESS',
          providerReference: 'BAZ-SELLER-1',
        }),
      });

      await service.handleProviderCallback('CINETPAY', {});

      const user = await prisma.user.findUnique({ where: { id: 'seller-1' } });
      expect(user?.role).toBe('SELLER');
      expect(user?.sellerFeePaid).toBe(true);
      expect(user?.sellerFeePending).toBe(false);
    });

    it('FAILED → tentative réinitialisée (pas activée, réessai possible)', async () => {
      mockProviderStatus('FAILED');
      mockFactory.getProvider.mockClear();
      mockFactory.getProvider.mockReturnValue({
        name: 'CINETPAY',
        initiatePayment: jest.fn(),
        checkStatus: jest.fn(),
        processCallback: jest.fn().mockResolvedValue({
          reference: 'BAZ-SELLER-1',
          status: 'FAILED',
          providerReference: 'BAZ-SELLER-1',
        }),
      });

      await service.handleProviderCallback('CINETPAY', {});

      const user = await prisma.user.findUnique({ where: { id: 'seller-1' } });
      expect(user?.role).toBe('BUYER');
      expect(user?.sellerFeePaid).toBe(false);
      expect(user?.sellerFeePending).toBe(false);
      expect(user?.sellerFeeRef).toBeNull();
    });

    it('PENDING → la tentative reste en attente (aucune action)', async () => {
      mockProviderStatus('PENDING');
      mockFactory.getProvider.mockClear();
      mockFactory.getProvider.mockReturnValue({
        name: 'CINETPAY',
        initiatePayment: jest.fn(),
        checkStatus: jest.fn(),
        processCallback: jest.fn().mockResolvedValue({
          reference: 'BAZ-SELLER-1',
          status: 'PENDING',
          providerReference: 'BAZ-SELLER-1',
        }),
      });

      await service.handleProviderCallback('CINETPAY', {});

      const user = await prisma.user.findUnique({ where: { id: 'seller-1' } });
      expect(user?.role).toBe('BUYER');
      expect(user?.sellerFeePaid).toBe(false);
      expect(user?.sellerFeePending).toBe(true);
    });
  });
});
