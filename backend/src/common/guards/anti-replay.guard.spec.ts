import { ForbiddenException } from '@nestjs/common';
import { AntiReplayGuard } from './anti-replay.guard';
import * as crypto from 'crypto';

// Clé partagée pour les tests
const TEST_API_SECRET = 'test-api-secret-0123456789';

function buildSignature(
  method: string,
  path: string,
  body: any,
  nonce: string,
  timestamp: string,
): string {
  const payload = `${method}:${path}:${JSON.stringify(body)}:${nonce}:${timestamp}`;
  return crypto.createHmac('sha256', TEST_API_SECRET).update(payload).digest('hex');
}

function mockContext(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body: any = {},
): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        originalUrl: path,
        url: path,
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
        body,
        id: 'test-correlation-id',
      }),
    }),
  };
}

describe('AntiReplayGuard', () => {
  let guard: AntiReplayGuard;

  beforeAll(() => {
    process.env.API_SECRET = TEST_API_SECRET;
  });

  beforeEach(() => {
    guard = new AntiReplayGuard();
  });

  afterAll(() => {
    delete process.env.API_SECRET;
  });

  // ─── Méthodes safe (GET, HEAD, OPTIONS) ───────────────────────────────

  it('devrait autoriser GET sans aucun header', () => {
    const ctx = mockContext('GET', '/api/v1/articles');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('devrait autoriser HEAD sans aucun header', () => {
    const ctx = mockContext('HEAD', '/api/v1/health');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('devrait autoriser OPTIONS sans aucun header', () => {
    const ctx = mockContext('OPTIONS', '/api/v1/auth/login');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ─── Routes d'auth publique ──────────────────────────────────────────

  it.each([
    '/api/v1/auth/send-otp',
    '/api/v1/auth/verify-otp',
    '/api/v1/auth/email/login',
    '/api/v1/auth/email/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/biometric-login',
  ])('devrait autoriser POST %s sans header de sécurité', (path) => {
    const ctx = mockContext('POST', path, {}, { phone: '+2250102030405' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ─── Headers manquants ──────────────────────────────────────────────

  it('devrait rejeter POST si headers X-Timestamp manquant', () => {
    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-nonce': 'abc123',
      'x-signature': 'def456',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('devrait rejeter POST si headers X-Nonce manquant', () => {
    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': Date.now().toString(),
      'x-signature': 'def456',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('devrait rejeter POST si headers X-Signature manquant', () => {
    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': Date.now().toString(),
      'x-nonce': 'abc123',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // ─── Timestamp invalide ─────────────────────────────────────────────

  it('devrait rejeter un timestamp non numérique', () => {
    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': 'not-a-number',
      'x-nonce': 'abc123',
      'x-signature': 'def456',
    });
    expect(() => guard.canActivate(ctx)).toThrow('Invalid timestamp format');
  });

  it('devrait rejeter un timestamp trop vieux (> 5 min)', () => {
    const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 min dans le passé
    const nonce = crypto.randomUUID();
    const sig = buildSignature(
      'POST', '/api/v1/transactions/initiate', { montant: 100 },
      nonce, oldTimestamp.toString(),
    );
    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': oldTimestamp.toString(),
      'x-nonce': nonce,
      'x-signature': sig,
    }, { montant: 100 });
    expect(() => guard.canActivate(ctx)).toThrow('Request expired');
  });

  it('devrait rejeter un timestamp futur (> 5 min)', () => {
    const futureTimestamp = Date.now() + 10 * 60 * 1000; // 10 min dans le futur
    const nonce = crypto.randomUUID();
    const sig = buildSignature(
      'POST', '/api/v1/transactions/initiate', { montant: 100 },
      nonce, futureTimestamp.toString(),
    );
    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': futureTimestamp.toString(),
      'x-nonce': nonce,
      'x-signature': sig,
    }, { montant: 100 });
    expect(() => guard.canActivate(ctx)).toThrow('Request expired');
  });

  // ─── Nonce dupliqué (replay) ────────────────────────────────────────

  it('devrait rejeter un nonce déjà utilisé (attaque replay)', () => {
    const now = Date.now().toString();
    const nonce = crypto.randomUUID();
    const sig = buildSignature('POST', '/api/v1/transactions/initiate', { montant: 100 }, nonce, now);

    const headers = {
      'x-timestamp': now,
      'x-nonce': nonce,
      'x-signature': sig,
    };

    const ctx = mockContext('POST', '/api/v1/transactions/initiate', headers, { montant: 100 });

    // Première requête : doit passer
    expect(guard.canActivate(ctx)).toBe(true);

    // Deuxième requête avec le même nonce : doit être rejetée
    expect(() => guard.canActivate(ctx)).toThrow('Nonce already used');
  });

  // ─── Signature invalide ─────────────────────────────────────────────

  it('devrait rejeter une signature incorrecte', () => {
    const now = Date.now().toString();
    const nonce = crypto.randomUUID();

    // Signature qui NE correspond PAS au payload
    const wrongSig = buildSignature('GET', '/different/path', {}, nonce, now);

    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': now,
      'x-nonce': nonce,
      'x-signature': wrongSig,
    }, { montant: 100 });

    expect(() => guard.canActivate(ctx)).toThrow('Invalid signature');
  });

  it('devrait rejeter une signature avec une longueur différente', () => {
    const now = Date.now().toString();
    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': now,
      'x-nonce': crypto.randomUUID(),
      'x-signature': 'too-short',
    });
    expect(() => guard.canActivate(ctx)).toThrow('Invalid signature');
  });

  // ─── Requête valide ─────────────────────────────────────────────────

  it('devrait accepter une requête POST valide avec tous les headers', () => {
    const now = Date.now().toString();
    const nonce = crypto.randomUUID();
    const sig = buildSignature('POST', '/api/v1/transactions/initiate', { montant: 100 }, nonce, now);

    const ctx = mockContext('POST', '/api/v1/transactions/initiate', {
      'x-timestamp': now,
      'x-nonce': nonce,
      'x-signature': sig,
    }, { montant: 100 });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('devrait accepter un PUT valide avec body vide', () => {
    const now = Date.now().toString();
    const nonce = crypto.randomUUID();
    const sig = buildSignature('PUT', '/api/v1/articles/123', {}, nonce, now);

    const ctx = mockContext('PUT', '/api/v1/articles/123', {
      'x-timestamp': now,
      'x-nonce': nonce,
      'x-signature': sig,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('devrait accepter un PATCH valide avec body', () => {
    const now = Date.now().toString();
    const nonce = crypto.randomUUID();
    const body = { nom: 'Nouveau Nom' };
    const sig = buildSignature('PATCH', '/api/v1/auth/profile', body, nonce, now);

    const ctx = mockContext('PATCH', '/api/v1/auth/profile', {
      'x-timestamp': now,
      'x-nonce': nonce,
      'x-signature': sig,
    }, body);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ─── DELETE ─────────────────────────────────────────────────────────

  it('devrait accepter un DELETE valide', () => {
    const now = Date.now().toString();
    const nonce = crypto.randomUUID();
    const sig = buildSignature('DELETE', '/api/v1/articles/123', {}, nonce, now);

    const ctx = mockContext('DELETE', '/api/v1/articles/123', {
      'x-timestamp': now,
      'x-nonce': nonce,
      'x-signature': sig,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
