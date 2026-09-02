import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function buildContext(user: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('devrait autoriser un utilisateur ADMIN', () => {
    const ctx = buildContext({ id: 'admin-1', role: 'ADMIN' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('devrait refuser un utilisateur BUYER', () => {
    const ctx = buildContext({ id: 'user-1', role: 'BUYER' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('devrait refuser un utilisateur SELLER', () => {
    const ctx = buildContext({ id: 'user-2', role: 'SELLER' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('devrait refuser une requête sans utilisateur', () => {
    const ctx = buildContext(null);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('devrait refuser un utilisateur sans rôle', () => {
    const ctx = buildContext({ id: 'user-3' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
