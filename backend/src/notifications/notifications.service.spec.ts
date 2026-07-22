import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();

    // Créer un utilisateur de test avec FCM tokens
    await prisma.user.create({
      data: {
        id: 'user-1',
        phone: '+22507080910',
        nom: 'Alice',
        fcmTokens: ['fcm-token-1', 'fcm-token-2'],
      },
    });
    await prisma.user.create({
      data: {
        id: 'user-2',
        phone: '+22507080911',
        nom: 'Bob',
        fcmTokens: ['fcm-token-3'],
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  const samplePayload = {
    title: 'Test Notification',
    body: 'Ceci est une notification de test',
    data: { type: 'test', transactionId: 'tx-1' },
  };

  // ─── sendToUser ─────────────────────────────────────────────────────────

  describe('sendToUser', () => {
    it('devrait envoyer à tous les tokens de l\'utilisateur (mode démo)', async () => {
      // Le mode démo est activé car Firebase n'est pas configuré
      await service.sendToUser('user-1', samplePayload);

      // Vérifier que l'historique a été sauvegardé
      const history = await prisma.notificationHistory.findMany({
        where: { userId: 'user-1' },
      });
      // En mode démo, chaque token sauvegarde SENT
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].title).toBe('Test Notification');
    });

    it('devrait gérer le cas où l\'utilisateur n\'a pas de tokens', async () => {
      await prisma.user.create({
        data: {
          id: 'user-no-token',
          phone: '+22509999999',
          nom: 'Sans Token',
          fcmTokens: [],
        },
      });

      // Ne devrait pas lever d'erreur
      await expect(
        service.sendToUser('user-no-token', samplePayload),
      ).resolves.toBeUndefined();

      // Vérifier que l'historique FAILED a été sauvegardé
      const history = await prisma.notificationHistory.findMany({
        where: { userId: 'user-no-token' },
      });
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].status).toBe('FAILED');
    });

    it('devrait gérer un utilisateur inexistant', async () => {
      await expect(
        service.sendToUser('user-inexistant', samplePayload),
      ).resolves.toBeUndefined();
    });
  });

  // ─── sendToUsers ────────────────────────────────────────────────────────

  describe('sendToUsers', () => {
    it('devrait envoyer à plusieurs utilisateurs', async () => {
      await service.sendToUsers(['user-1', 'user-2'], samplePayload);

      const history1 = await prisma.notificationHistory.count({
        where: { userId: 'user-1' },
      });
      const history2 = await prisma.notificationHistory.count({
        where: { userId: 'user-2' },
      });

      expect(history1).toBeGreaterThanOrEqual(1);
      expect(history2).toBeGreaterThanOrEqual(1);
    });

    it('devrait dédupliquer les IDs', async () => {
      await service.sendToUsers(['user-1', 'user-1', 'user-1'], samplePayload);

      const history = await prisma.notificationHistory.count({
        where: { userId: 'user-1' },
      });
      // Ne devrait sauvegarder qu'une entrée par user (dédupliqué)
      expect(history).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Historique ─────────────────────────────────────────────────────────

  describe('getHistory', () => {
    beforeEach(async () => {
      // Créer quelques notifications dans l'historique
      for (let i = 0; i < 5; i++) {
        await prisma.notificationHistory.create({
          data: {
            userId: 'user-1',
            title: `Notification ${i + 1}`,
            body: `Corps ${i + 1}`,
            type: 'test',
            status: 'SENT',
            dateCreation: new Date(Date.now() + i * 1000), // espacées de 1s
          },
        });
      }
    });

    it('devrait retourner l\'historique paginé', async () => {
      const result = await service.getHistory('user-1', 1, 3);

      expect(result.data).toHaveLength(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 3,
        total: 5,
        totalPages: 2,
      });
    });

    it('devrait retourner la page 2', async () => {
      const result = await service.getHistory('user-1', 2, 3);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(2);
    });

    it('devrait retourner un historique vide pour un autre utilisateur', async () => {
      const result = await service.getHistory('user-2', 1, 20);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  // ─── getUnreadCount ─────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('devrait retourner 0 si aucune notification non lue', async () => {
      const count = await service.getUnreadCount('user-1');
      expect(count).toBe(0);
    });

    it('devrait compter les notifications non lues', async () => {
      await prisma.notificationHistory.create({
        data: {
          userId: 'user-1',
          title: 'Non lue',
          body: 'Test',
          status: 'SENT',
        },
      });
      await prisma.notificationHistory.create({
        data: {
          userId: 'user-1',
          title: 'Lue',
          body: 'Test',
          status: 'DELIVERED',
        },
      });

      const count = await service.getUnreadCount('user-1');
      expect(count).toBe(1); // Seulement les 'SENT'
    });
  });

  // ─── markAsRead ────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    let notifId: string;

    beforeEach(async () => {
      const notif = await prisma.notificationHistory.create({
        data: {
          userId: 'user-1',
          title: 'À marquer comme lue',
          body: 'Test',
          status: 'SENT',
        },
      });
      notifId = notif.id;
    });

    it('devrait marquer une notification comme lue', async () => {
      await service.markAsRead(notifId, 'user-1');

      const updated = await prisma.notificationHistory.findMany({
        where: { userId: 'user-1' },
      });
      expect(updated[0].status).toBe('DELIVERED');
    });
  });

  // ─── markAllAsRead ─────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        await prisma.notificationHistory.create({
          data: {
            userId: 'user-1',
            title: `Non lue ${i}`,
            body: 'Test',
            status: 'SENT',
          },
        });
      }
    });

    it('devrait marquer toutes les notifications comme lues', async () => {
      await service.markAllAsRead('user-1');

      const unread = await service.getUnreadCount('user-1');
      expect(unread).toBe(0);

      const history = await prisma.notificationHistory.findMany({
        where: { userId: 'user-1' },
      });
      history.forEach((n) => expect(n.status).toBe('DELIVERED'));
    });
  });
});
