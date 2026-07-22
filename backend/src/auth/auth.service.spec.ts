import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { MockPrismaService } from '../common/prisma/__mocks__/prisma.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    prisma = new MockPrismaService();
    prisma.resetStore();

    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  // ─── sendOtp ────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('devrait créer un nouvel utilisateur et retourner un message de succès', async () => {
      const result = await service.sendOtp('+22507080910');

      expect(result).toHaveProperty('message', 'Code envoyé');
      expect(result).toHaveProperty('expiresIn', 300);

      const user = await prisma.user.findUnique({ where: { phone: '+22507080910' } });
      expect(user).not.toBeNull();
      expect(user!.otpSecret).toHaveLength(6); // 6 chiffres
      expect(user!.otpExpiresAt).toBeInstanceOf(Date);
    });

    it('devrait mettre à jour un utilisateur existant avec un nouveau code', async () => {
      // Créer un utilisateur existant
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Test',
          otpSecret: '000000',
          otpExpiresAt: new Date(Date.now() + 60000),
        },
      });

      const result = await service.sendOtp('+22507080910');
      expect(result.message).toBe('Code envoyé');

      const user = await prisma.user.findUnique({ where: { phone: '+22507080910' } });
      expect(user!.otpSecret).not.toBe('000000'); // Nouveau code
    });
  });

  // ─── verifyOtp ──────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Alice',
          otpSecret: '123456',
          otpExpiresAt: new Date(Date.now() + 300000), // valide 5 min
        },
      });
    });

    it('devrait vérifier le code OTP et retourner des tokens', async () => {
      const result = await service.verifyOtp('+22507080910', '123456');

      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toHaveProperty('nom', 'Alice');
    });

    it('devrait lever une erreur si aucun code demandé', async () => {
      await expect(
        service.verifyOtp('+22509999999', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever une erreur si code invalide', async () => {
      await expect(
        service.verifyOtp('+22507080910', '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever une erreur si code expiré', async () => {
      // Modifier la date d'expiration
      await prisma.user.update({
        where: { id: 'user-1' },
        data: { otpExpiresAt: new Date(Date.now() - 60000) }, // expiré
      });

      await expect(
        service.verifyOtp('+22507080910', '123456'),
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
          refreshToken: 'valid-refresh-token',
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

  // ─── Biométrie ─────────────────────────────────────────────────────────

  describe('enableBiometric', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          id: 'user-1',
          phone: '+22507080910',
          nom: 'Alice',
          refreshToken: 'valid-refresh-token',
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
          refreshToken: 'valid-refresh-token',
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
