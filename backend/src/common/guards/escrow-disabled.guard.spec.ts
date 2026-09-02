import { GoneException } from '@nestjs/common';
import { EscrowDisabledGuard } from './escrow-disabled.guard';

describe('EscrowDisabledGuard', () => {
  let guard: EscrowDisabledGuard;

  beforeEach(() => {
    guard = new EscrowDisabledGuard();
  });

  it('devrait être défini', () => {
    expect(guard).toBeDefined();
  });

  it('devrait toujours lever 410 Gone (escrow désactivé, achat P2P)', () => {
    const mockRequest = {
      method: 'POST',
      originalUrl: '/api/v1/transactions/initiate',
      url: '/api/v1/transactions/initiate',
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    };

    expect(() => guard.canActivate(context)).toThrow(GoneException);
  });

  it('devrait fournir un message expliquant le paiement direct au vendeur', () => {
    const mockRequest = {
      method: 'POST',
      originalUrl: '/api/v1/payments/mobile-money/initiate',
      url: '/api/v1/payments/mobile-money/initiate',
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    };

    try {
      guard.canActivate(context);
      fail('Le guard aurait dû lever une exception');
    } catch (error: any) {
      expect(error).toBeInstanceOf(GoneException);
      expect(error.message).toContain('escrow');
      expect(error.message).toContain('messagerie');
      expect(error.message).toContain('Mobile Money');
    }
  });
});
