import { UnauthorizedException } from '@nestjs/common';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import * as crypto from 'crypto';

const TEST_WEBHOOK_SECRET = 'test-webhook-secret-0123456789';

function buildSignature(body: Buffer | string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function mockContext(
  headers: Record<string, string> = {},
  body: any = {},
  rawBody?: Buffer,
): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/api/v1/payments/webhook/ligdicash',
        url: '/api/v1/payments/webhook/ligdicash',
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
        body,
        rawBody,
      }),
    }),
  };
}

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;

  beforeEach(() => {
    guard = new WebhookSignatureGuard();
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.REQUIRE_WEBHOOK_SIGNATURE;
  });

  // ─── Méthodes safe ─────────────────────────────────────────────────────

  it('devrait autoriser OPTIONS (preflight) sans signature', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.REQUIRE_WEBHOOK_SIGNATURE = 'true';
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'OPTIONS',
          headers: {},
        }),
      }),
    };
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ─── WEBHOOK_SECRET non configuré ─────────────────────────────────────

  it('devrait accepter la requête si WEBHOOK_SECRET est absent (mode simulation)', () => {
    delete process.env.WEBHOOK_SECRET;
    const ctx = mockContext({}, { cpm_trans_id: 'T1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ─── Signature valide ─────────────────────────────────────────────────

  it('devrait accepter une signature HMAC valide sur le corps brut', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const bodyBuffer = Buffer.from(JSON.stringify({ cpm_trans_id: 'T1', cpm_site_id: '123456' }));
    const sig = buildSignature(bodyBuffer, TEST_WEBHOOK_SECRET);
    const ctx = mockContext({ 'x-signature': sig }, JSON.parse(bodyBuffer.toString()), bodyBuffer);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('devrait accepter une signature valide avec timestamp frais', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const bodyBuffer = Buffer.from('{"cpm_trans_id":"T1"}');
    const now = Date.now().toString();
    const sig = buildSignature(bodyBuffer, TEST_WEBHOOK_SECRET);
    const ctx = mockContext({ 'x-signature': sig, 'x-timestamp': now }, { cpm_trans_id: 'T1' }, bodyBuffer);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ─── Signature invalide ───────────────────────────────────────────────

  it('devrait rejeter une signature incorrecte', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const bodyBuffer = Buffer.from('{"cpm_trans_id":"T1"}');
    const wrongSig = buildSignature(Buffer.from('{"cpm_trans_id":"T2"}'), TEST_WEBHOOK_SECRET);
    const ctx = mockContext({ 'x-signature': wrongSig }, { cpm_trans_id: 'T1' }, bodyBuffer);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('devrait rejeter une signature de longueur différente', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const ctx = mockContext({ 'x-signature': 'too-short' }, { cpm_trans_id: 'T1' }, Buffer.from('{"cpm_trans_id":"T1"}'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('devrait rejeter une signature qui ne correspond pas au corps brut', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    // Signature calculée sur un autre corps que celui réellement reçu
    const sig = buildSignature(Buffer.from('{"cpm_trans_id":"FORGE"}'), TEST_WEBHOOK_SECRET);
    const bodyBuffer = Buffer.from('{"cpm_trans_id":"T1"}');
    const ctx = mockContext({ 'x-signature': sig }, { cpm_trans_id: 'T1' }, bodyBuffer);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  // ─── Timestamp invalide ───────────────────────────────────────────────

  it('devrait rejeter un timestamp non numérique', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const bodyBuffer = Buffer.from('{"cpm_trans_id":"T1"}');
    const ctx = mockContext(
      { 'x-signature': buildSignature(bodyBuffer, TEST_WEBHOOK_SECRET), 'x-timestamp': 'abc' },
      { cpm_trans_id: 'T1' },
      bodyBuffer,
    );
    expect(() => guard.canActivate(ctx)).toThrow('Timestamp invalide ou expiré');
  });

  it('devrait rejeter un timestamp trop vieux (> 5 min)', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const bodyBuffer = Buffer.from('{"cpm_trans_id":"T1"}');
    const old = (Date.now() - 10 * 60 * 1000).toString();
    const ctx = mockContext(
      { 'x-signature': buildSignature(bodyBuffer, TEST_WEBHOOK_SECRET), 'x-timestamp': old },
      { cpm_trans_id: 'T1' },
      bodyBuffer,
    );
    expect(() => guard.canActivate(ctx)).toThrow('Timestamp invalide ou expiré');
  });

  it('devrait rejeter un timestamp trop futur (> 5 min)', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const bodyBuffer = Buffer.from('{"cpm_trans_id":"T1"}');
    const future = (Date.now() + 10 * 60 * 1000).toString();
    const ctx = mockContext(
      { 'x-signature': buildSignature(bodyBuffer, TEST_WEBHOOK_SECRET), 'x-timestamp': future },
      { cpm_trans_id: 'T1' },
      bodyBuffer,
    );
    expect(() => guard.canActivate(ctx)).toThrow('Timestamp invalide ou expiré');
  });

  // ─── Signature absente ────────────────────────────────────────────────

  it('devrait accepter sans signature si REQUIRE_WEBHOOK_SIGNATURE est absent', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const ctx = mockContext({}, { cpm_trans_id: 'T1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('devrait rejeter sans signature si REQUIRE_WEBHOOK_SIGNATURE=true', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.REQUIRE_WEBHOOK_SIGNATURE = 'true';
    const ctx = mockContext({}, { cpm_trans_id: 'T1' });
    expect(() => guard.canActivate(ctx)).toThrow('Signature webhook manquante');
  });

  // ─── Fallback sans rawBody (corps reconstruit) ───────────────────────

  it('devrait vérifier via le corps parsé si rawBody est absent (rétro-compat)', () => {
    process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const body = { cpm_trans_id: 'T1' };
    const sig = buildSignature(JSON.stringify(body), TEST_WEBHOOK_SECRET);
    const ctx = mockContext({ 'x-signature': sig }, body, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
