import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { MobileMoneyFactory } from '../payments/mobile-money.service';
import { EmailService } from '../common/email/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let jwtService: JwtService;
  let module: TestingModule;

  // Hash argon2 pré-calculé du code '123456' (les OTP sont hashés en base)
  let otpHash: string;

  beforeAll(async () => {
    otpHash = await argon2.hash('123456');
  });

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-1', phone: '+22507080910' }),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn((value: string) => value),
            decrypt: jest.fn((value: any) => value),
            hashForSearch: jest.fn((value: string) => value),
          },
        },
        {
          provide: MobileMoneyFactory,
          useValue: {
            getProvider: jest.fn(() => ({
              name: 'ORANGE_MONEY',
              initiatePayment: jest.fn().mockResolvedValue({
                success: true,
                providerReference: 'OR-TEST-123',
                message: 'Paiement initié',
                status: 'PENDING',
              }),
              checkStatus: jest.fn().mockResolvedValue({
                success: true,
                providerReference: 'OR-TEST-123',
                message: 'Paiement confirmé',
                status: 'SUCCESS',
              }),
              processCallback: jest.fn(),
            })),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendOtpCode: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  // ─── sendOtp ────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('devrait créer un nouvel utilisateur et retourner un message de succès', async () => {
      const result = await service.sendOtp('alice@example.com');

      expect(result).toHaveProperty('message', 'Code envoyé par email');
      expect(result).toHaveProperty('expiresIn', 300);

      const user = await prisma.user.findFirst({ where: { phone: '_email_alice_example_com' } });
      expect(user).not.toBeNull();
      // Le code est hashé avec argon2 (pas stocké en clair)
      expect(user!.otpSecret).toContain('$argon2');
      expect(user!.otpExpiresAt).toBeInstanceOf(Date);
    });

    it('devrait mettre à jour un utilisateur existant avec un nouveau code', async () => {
      // Créer un utilisateur existant avec un email
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '_email_alice_example_com',
          emailHash: 'alice@example.com',
          nom: 'Test',
          otpSecret: otpHash,
          otpExpiresAt: new Date(Date.now() + 60000),
        },
      });

      const result = await service.sendOtp('alice@example.com');
      expect(result.message).toBe('Code envoyé par email');

      const user = await prisma.user.findUnique({ where: { id: 'user-1' } });
      expect(user!.otpSecret).not.toBe(otpHash); // Nouveau hash
    });

    it('devrait demander l\'envoi de l\'email à EmailService', async () => {
      const emailService = module.get<EmailService>(EmailService);
      await service.sendOtp('alice@example.com');
      expect(emailService.sendOtpCode).toHaveBeenCalledWith(
        'alice@example.com',
        expect.any(String),
      );
    });

    it("devrait lever une erreur en production si l'envoi email échoue", async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const emailService = module.get<EmailService>(EmailService);
        (emailService.sendOtpCode as jest.Mock).mockResolvedValueOnce(false);

        await expect(service.sendOtp('alice@example.com')).rejects.toThrow('envoyer le code');
      } finally {
        if (prevEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevEnv;
      }
    });
  });

  // ─── verifyOtp ──────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '_email_alice_example_com',
          emailHash: 'alice@example.com',
          nom: 'Alice',
          otpSecret: otpHash, // hash argon2 de '123456'
          otpExpiresAt: new Date(Date.now() + 300000), // valide 5 min
        } as any,
      });
    });

    it('devrait vérifier le code OTP et retourner des tokens', async () => {
      const result = await service.verifyOtp('alice@example.com', '123456');

      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toHaveProperty('nom', 'Alice');
    });

    it('devrait lever une erreur si aucun code demandé', async () => {
      await expect(
        service.verifyOtp('unknown@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever une erreur si code invalide', async () => {
      await expect(
        service.verifyOtp('alice@example.com', '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever une erreur si code expiré', async () => {
      // Modifier la date d'expiration
      await prisma.user.update({
        where: { id: 'user-1' },
        data: { otpExpiresAt: new Date(Date.now() - 60000) }, // expiré
      });

      await expect(
        service.verifyOtp('alice@example.com', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── refreshTokens ─────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Alice',
          refreshTokenEncrypted: 'valid-refresh-token',
        },
      });
    });

    it('devrait rafraîchir les tokens avec un refresh token valide', async () => {
      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken');
    });

    it('devrait lever une erreur si le token est invalide', async () => {
      (jwtService.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Token invalide');
      });

      await expect(
        service.refreshTokens('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── getProfile ────────────────────────────────────────────────────────

  describe('getProfile', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Alice',
          ville: 'Abidjan',
          bio: 'Vendeuse passionnée',
        },
      });
    });

    it('devrait retourner le profil utilisateur', async () => {
      const profile = await service.getProfile('user-1');
      expect(profile).toHaveProperty('nom', 'Alice');
      expect(profile).toHaveProperty('ville', 'Abidjan');
      expect(profile).toHaveProperty('bio', 'Vendeuse passionnée');
    });
  });

  // ─── updateProfile ─────────────────────────────────────────────────────

  describe('updateProfile', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: { id: 'user-1', phone: '+22507080910', nom: 'Alice' },
      });
    });

    it('devrait mettre à jour le nom', async () => {
      const updated = await service.updateProfile('user-1', { nom: 'Alice K.' });
      expect(updated).toHaveProperty('nom', 'Alice K.');
    });

    it('devrait mettre à jour la ville', async () => {
      const updated = await service.updateProfile('user-1', { ville: 'Dakar' });
      expect(updated).toHaveProperty('ville', 'Dakar');
    });
  });

  // ─── Activation vendeur (paiement 1000 FCFA) ─────────────────────────

  describe('activateSeller (paiement)', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-seller',
          phone: '+22507080910',
          nom: 'Alice Vendeuse',
          role: 'SELLER',
          sellerFeePaid: false,
          sellerFeePending: false,
        },
      });
    });

    it('devrait initier un paiement et marquer la tentative en attente', async () => {
      const result = await service.activateSeller('user-seller', '+22507080910', 'ORANGE_MONEY');

      expect(result).toHaveProperty('status', 'PENDING');
      expect(result).toHaveProperty('providerReference');

      const user = await prisma.user.findUnique({ where: { id: 'user-seller' } });
      expect(user!.sellerFeePending).toBe(true);
      expect(user!.sellerFeePaid).toBe(false);
      expect(user!.sellerFeeRef).toBeTruthy();
    });

    it('devrait refuser si les frais sont déjà payés', async () => {
      await prisma.user.update({
        where: { id: 'user-seller' },
        data: { sellerFeePaid: true },
      });
      await expect(
        service.activateSeller('user-seller', '+22507080910', 'ORANGE_MONEY'),
      ).rejects.toThrow('Un paiement est déjà en cours ou les frais ont déjà été payés');
    });

    it('devrait permettre à un acheteur (BUYER) d\'initier le paiement (upgrade possible)', async () => {
      await prisma.user.update({
        where: { id: 'user-seller' },
        data: { role: 'BUYER' },
      });

      const result = await service.activateSeller('user-seller', '+22507080910', 'ORANGE_MONEY');
      expect(result).toHaveProperty('status', 'PENDING');

      const user = await prisma.user.findUnique({ where: { id: 'user-seller' } });
      expect(user!.sellerFeePending).toBe(true);
    });

    it('devrait refuser si un paiement est déjà en cours (non expiré)', async () => {
      await prisma.user.update({
        where: { id: 'user-seller' },
        data: { sellerFeePending: true, sellerFeePendingAt: new Date() },
      });
      await expect(
        service.activateSeller('user-seller', '+22507080910', 'ORANGE_MONEY'),
      ).rejects.toThrow('paiement est déjà en cours');
    });

    it('devrait autoriser une nouvelle tentative après expiration (15 min)', async () => {
      await prisma.user.update({
        where: { id: 'user-seller' },
        data: {
          sellerFeePending: true,
          sellerFeePendingAt: new Date(Date.now() - 20 * 60 * 1000), // expiré
        },
      });

      const result = await service.activateSeller('user-seller', '+22507080910', 'ORANGE_MONEY');
      expect(result).toHaveProperty('status', 'PENDING');
    });
  });

  describe('confirmSellerActivation', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-seller',
          phone: '+22507080910',
          nom: 'Alice Vendeuse',
          role: 'SELLER',
          sellerFeePaid: false,
          sellerFeePending: true,
          sellerFeePendingAt: new Date(),
          sellerFeeRef: 'OR-TEST-123',
          sellerFeeProvider: 'ORANGE_MONEY',
        },
      });
    });

    it('devrait activer le compte si le paiement est confirmé (happy path)', async () => {
      const result = await service.confirmSellerActivation('user-seller', 'OR-TEST-123');
      expect(result).toHaveProperty('sellerFeePaid', true);

      const user = await prisma.user.findUnique({ where: { id: 'user-seller' } });
      expect(user!.sellerFeePaid).toBe(true);
      expect(user!.sellerFeePending).toBe(false);
      expect(user!.sellerFeeRef).toBeNull();
    });

    it('devrait passer le rôle à SELLER lors de la confirmation (upgrade BUYER)', async () => {
      await prisma.user.update({
        where: { id: 'user-seller' },
        data: { role: 'BUYER' },
      });

      await service.confirmSellerActivation('user-seller', 'OR-TEST-123');

      const user = await prisma.user.findUnique({ where: { id: 'user-seller' } });
      expect(user!.role).toBe('SELLER');
      expect(user!.sellerFeePaid).toBe(true);
    });

    it('devrait retourner un succès si le compte est déjà activé (webhook antérieur)', async () => {
      await prisma.user.update({
        where: { id: 'user-seller' },
        data: { sellerFeePaid: true, sellerFeePending: false },
      });

      const result = await service.confirmSellerActivation('user-seller', 'OR-TEST-123');
      expect(result).toHaveProperty('sellerFeePaid', true);
    });

    it('devrait refuser une référence de paiement invalide', async () => {
      await expect(
        service.confirmSellerActivation('user-seller', 'WRONG-REF'),
      ).rejects.toThrow('Référence de paiement invalide');
    });

    it('devrait refuser si le paiement nest pas confirmé par le provider', async () => {
      // Simuler un provider qui renvoie FAILED (ex: production sans clé API)
      const mobileMoneyFactory = module.get<MobileMoneyFactory>(MobileMoneyFactory);
      (mobileMoneyFactory.getProvider as jest.Mock).mockReturnValueOnce({
        name: 'ORANGE_MONEY',
        initiatePayment: jest.fn(),
        checkStatus: jest.fn().mockResolvedValue({
          success: false,
          providerReference: 'OR-TEST-123',
          message: 'Paiement indisponible (clé API manquante)',
          status: 'FAILED',
        }),
        processCallback: jest.fn(),
      });

      await expect(
        service.confirmSellerActivation('user-seller', 'OR-TEST-123'),
      ).rejects.toThrow('Paiement indisponible');

      // Le compte ne doit PAS être activé
      const user = await prisma.user.findUnique({ where: { id: 'user-seller' } });
      expect(user!.sellerFeePaid).toBe(false);
    });

    it('devrait signaler un paiement encore en cours (PENDING) sans activer le compte', async () => {
      // Simuler un provider qui renvoie PENDING (paiement en cours)
      const mobileMoneyFactory = module.get<MobileMoneyFactory>(MobileMoneyFactory);
      (mobileMoneyFactory.getProvider as jest.Mock).mockReturnValueOnce({
        name: 'ORANGE_MONEY',
        initiatePayment: jest.fn(),
        checkStatus: jest.fn().mockResolvedValue({
          success: false,
          providerReference: 'OR-TEST-123',
          message: 'Statut: WAITING_CUSTOMER_PAYMENT',
          status: 'PENDING',
        }),
        processCallback: jest.fn(),
      });

      await expect(
        service.confirmSellerActivation('user-seller', 'OR-TEST-123'),
      ).rejects.toThrow('encore en cours de traitement');

      // La tentative reste en attente (pas réinitialisée, pas activée)
      const user = await prisma.user.findUnique({ where: { id: 'user-seller' } });
      expect(user!.sellerFeePaid).toBe(false);
      expect(user!.sellerFeePending).toBe(true);
      expect(user!.sellerFeeRef).toBe('OR-TEST-123');
    });
  });

  // ─── Biométrie ─────────────────────────────────────────────────────────

  describe('enableBiometric', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Alice',
          refreshTokenEncrypted: 'valid-refresh-token',
        },
      });
    });

    it('devrait activer la biométrie', async () => {
      const result = await service.enableBiometric('user-1', 'valid-refresh-token');
      expect(result.biometricEnabled).toBe(true);
      expect(result.message).toContain('activée');
    });

    it('devrait lever une erreur si le refresh token ne correspond pas', async () => {
      await expect(
        service.enableBiometric('user-1', 'wrong-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('disableBiometric', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Alice',
          biometricEnabled: true,
        },
      });
    });

    it('devrait désactiver la biométrie', async () => {
      const result = await service.disableBiometric('user-1');
      expect(result.biometricEnabled).toBe(false);
      expect(result.message).toContain('désactivée');
    });
  });

  describe('biometricLogin', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Alice',
          refreshTokenEncrypted: 'valid-refresh-token',
          biometricEnabled: true,
        },
      });
    });

    it('devrait connecter via biométrie avec un token valide', async () => {
      const result = await service.biometricLogin('valid-refresh-token');
      expect(result).toHaveProperty('accessToken');
      expect(result.user).toHaveProperty('nom', 'Alice');
    });

    it('devrait lever une erreur si la biométrie n\'est pas activée', async () => {
      await prisma.user.update({
        where: { id: 'user-1' },
        data: { biometricEnabled: false },
      });

      await expect(
        service.biometricLogin('valid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
