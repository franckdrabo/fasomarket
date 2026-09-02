import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Intercepteur global qui nettoie les réponses JSON.
 *
 * Convertit récursivement tout Buffer / Uint8Array en `null` pour éviter
 * que des bytes chiffrés ne soient sérialisés comme `{"0": 98, "1": 97, ...}`
 * et ne fassent planter React Native (erreur "Objects are not valid as a
 * React child").
 *
 * C'est le filet de sécurité ultime : même si l'extension Prisma de
 * chiffrement ne déchiffre pas correctement un champ Bytes, le client
 * recevra `null` au lieu d'un objet poubelle.
 *
 * Les références circulaires ne sont pas gérées intentionnellement :
 * - Prisma ne produit jamais d'objets circulaires
 * - JSON.stringify lèvera une erreur claire si ça arrive
 * - Un WeakSet créerait des faux positifs (objets partagés transformés en null)
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => this.sanitize(data)),
    );
  }

  private sanitize(value: unknown): unknown {
    // Buffer / Uint8Array → null (ne jamais exposer des bytes bruts !)
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return null;
    }

    // Date → laisser passer intact (JSON.stringify le sérialise en ISO)
    if (value instanceof Date) {
      return value;
    }

    // null / undefined / primitives → inchangé
    if (value === null || value === undefined || typeof value !== 'object') {
      return value;
    }

    // Array → traiter chaque élément
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    // Object → traiter chaque propriété récursivement
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = this.sanitize(val);
    }
    return sanitized;
  }
}