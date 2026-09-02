import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import * as crypto from 'crypto';

/**
 * WebhookSignatureGuard
 *
 * Vérifie l'authenticité des webhooks entrants (ex: callbacks LigdiCash) via
 * une signature HMAC-SHA256 calculée sur le CORPS BRUT de la requête :
 *
 *   X-Signature = HMAC-SHA256(rawBody, WEBHOOK_SECRET)   (hex)
 *
 * Headers optionnels :
 *   - X-Timestamp : timestamp UNIX en ms (±5 min de tolérance, anti-replay)
 *
 * Politique d'application :
 *   - WEBHOOK_SECRET non défini        → requête acceptée (mode dev/simulation,
 *     cohérent avec le reste de l'app (mode dev/simulation).
 *   - Signature présente               → TOUJOURS vérifiée (comparaison à temps
 *     constant) ; invalide → 401.
 *   - Signature absente                → acceptée par défaut (certaines passerelles
 *     ne signent pas leurs callbacks ; l'authenticité repose sur la re-vérification
 *     côté serveur).
 *     Mettre REQUIRE_WEBHOOK_SIGNATURE=true pour exiger la signature.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  /** Fenêtre de tolérance temporelle : ±5 minutes */
  private readonly TIME_WINDOW_MS = 5 * 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<ExpressRequest>>();

    // Les méthodes safe (OPTIONS preflight…) ne sont pas signées.
    const method = request.method;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    const secret = process.env.WEBHOOK_SECRET;

    // Aucun secret configuré → on n'exige pas de signature (dev/simulation).
    if (!secret) {
      this.logger.debug('⚠️ WEBHOOK_SECRET non défini — webhooks acceptés sans vérification de signature.');
      return true;
    }

    const signature = request.headers?.['x-signature'] as string | undefined;

    // ─── Signature absente ───────────────────────────────────────────────
    if (!signature) {
      if (process.env.REQUIRE_WEBHOOK_SIGNATURE === 'true') {
        this.logger.warn('🚫 Webhook rejeté : X-Signature manquante (REQUIRE_WEBHOOK_SIGNATURE=true).');
        throw new UnauthorizedException('Signature webhook manquante');
      }
      // Callback sans signature accepté (la passerelle ne signe pas ses callbacks).
      this.logger.debug('Webhook sans signature accepté.');
      return true;
    }

    // ─── Timestamp optionnel (anti-replay) ───────────────────────────────
    const timestamp = request.headers?.['x-timestamp'] as string | undefined;
    if (timestamp) {
      const clientTimestamp = parseInt(timestamp, 10);
      if (isNaN(clientTimestamp) || Math.abs(Date.now() - clientTimestamp) > this.TIME_WINDOW_MS) {
        throw new UnauthorizedException('Timestamp invalide ou expiré');
      }
    }

    // ─── Vérification HMAC sur le corps brut ─────────────────────────────
    // main.ts est créé avec { rawBody: true } → request.rawBody est un Buffer.
    // Fallback : reconstruire depuis le corps parsé (uniquement pour la rétro-compat).
    const rawBody = (request as any).rawBody;
    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(JSON.stringify(request.body ?? {}), 'utf8');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('hex');

    if (expectedSignature.length !== signature.length) {
      throw new UnauthorizedException('Signature webhook invalide');
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex'),
    );

    if (!isValid) {
      throw new UnauthorizedException('Signature webhook invalide');
    }

    return true;
  }
}
