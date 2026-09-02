import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Anti-Replay Guard
 *
 * Vérifie que chaque requête contient :
 *   - X-Timestamp : timestamp UNIX en ms (±5 min de tolérance)
 *   - X-Nonce     : UUIDv4 unique par requête
 *   - X-Signature : HMAC-SHA256(method + path + body + nonce + timestamp, API_SECRET)
 *
 * Protège contre les attaques par rejeu (replay attacks) :
 * une requête interceptée ne peut pas être renvoyée plus tard.
 *
 * Note : En production, utilisez Redis avec SET NX EX pour le stockage
 * des nonces. Ici, on utilise un Map en mémoire (single instance uniquement).
 */
@Injectable()
export class AntiReplayGuard implements CanActivate {
  /** Cache mémoire des nonces utilisés (remplacé par Redis en prod) */
  private readonly usedNonces = new Map<string, number>();

  /** Intervalle de nettoyage (toutes les 5 minutes) */
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000;

  /** Fenêtre de tolérance temporelle : ±5 minutes */
  private readonly TIME_WINDOW_MS = 5 * 60 * 1000;

  /** Nombre maximum de nonces en mémoire avant nettoyage */
  private readonly MAX_NONCES = 10000;

  constructor() {
    // Nettoyage périodique des nonces expirés
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /** Routes d'auth publique qui ne nécessitent pas de signature */
  private readonly PUBLIC_AUTH_PATHS = [
    '/api/v1/auth/send-otp',
    '/api/v1/auth/verify-otp',
    '/api/v1/auth/email/login',
    '/api/v1/auth/email/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/biometric-login',
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.originalUrl || request.url;

    // Ignorer les méthodes safe (GET, HEAD, OPTIONS)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method)) {
      return true;
    }

    // Ignorer les routes d'auth publique (pas de signature possible sans être connecté)
    if (this.PUBLIC_AUTH_PATHS.some((p) => path.startsWith(p))) {
      return true;
    }

    const timestamp = request.headers['x-timestamp'];
    const nonce = request.headers['x-nonce'];
    const signature = request.headers['x-signature'];

    // Vérifier la présence des headers
    if (!timestamp || !nonce || !signature) {
      throw new ForbiddenException('Missing security headers');
    }

    const clientTimestamp = parseInt(timestamp, 10);
    const now = Date.now();

    // 1. Vérifier le format du timestamp
    if (isNaN(clientTimestamp)) {
      throw new ForbiddenException('Invalid timestamp format');
    }

    // 2. Vérifier la fraîcheur du timestamp (±5 min)
    if (Math.abs(now - clientTimestamp) > this.TIME_WINDOW_MS) {
      throw new ForbiddenException('Request expired or invalid timestamp');
    }

    // 3. Vérifier l'unicité du nonce
    if (this.usedNonces.has(nonce)) {
      throw new ForbiddenException('Nonce already used (replay detected)');
    }

    // 4. Recalculer et vérifier la signature HMAC
    const apiSecret = process.env.API_SECRET || '';
    if (!apiSecret) {
      // En production, API_SECRET est obligatoire
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('Server configuration error');
      }
    }

    const bodyString = JSON.stringify(request.body || {});
    const payloadToSign = `${method}:${path}:${bodyString}:${nonce}:${timestamp}`;

    const expectedSignature = crypto
      .createHmac('sha256', apiSecret)
      .update(payloadToSign)
      .digest('hex');

    // Comparaison à temps constant (timing-safe)
    if (expectedSignature.length !== (signature as string).length) {
      throw new ForbiddenException('Invalid signature');
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature as string, 'hex'),
    );

    if (!isValid) {
      throw new ForbiddenException('Invalid signature');
    }

    // 5. Stocker le nonce (expire après TIME_WINDOW_MS)
    this.usedNonces.set(nonce as string, now);
    if (this.usedNonces.size > this.MAX_NONCES) {
      this.cleanup();
    }

    return true;
  }

  /** Nettoie les nonces expirés du cache mémoire */
  private cleanup() {
    const now = Date.now();
    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (now - timestamp > this.TIME_WINDOW_MS) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}
