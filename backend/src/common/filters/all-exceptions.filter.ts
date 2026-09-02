import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

/**
 * Filtre global d'exceptions.
 *
 * Garantit que JAMAIS une erreur technique (stack trace, message SQL,
 * nom de fichier, etc.) n'est renvoyée au client.
 *
 * Toutes les erreurs sont loggées côté serveur avec leur stack trace,
 * mais le client reçoit uniquement un message générique.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Une erreur interne est survenue. Veuillez réessayer plus tard.';

    // ─── HttpException (connue) ──────────────────────────────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Messages d'erreur de validation (class-validator)
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;
        if (Array.isArray(resp.message)) {
          // Garder les messages de validation (par ex: "email must be an email")
          message = resp.message;
        } else if (typeof resp.message === 'string') {
          message = resp.message;
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    }

    // ─── ThrottlerException (rate limiting) ─────────────────────────────
    if (exception instanceof ThrottlerException) {
      message = 'Trop de requêtes. Veuillez patienter avant de réessayer.';
    }

    // ─── Log serveur (toujours, pour le diagnostic) ──────────────────────
    const correlationId = request.headers['x-correlation-id'] || request.id || 'unknown';
    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} → ${status}`,
    );
    if (exception instanceof Error) {
      this.logger.error(`Stack: ${exception.stack}`);
    } else {
      this.logger.error(`Exception: ${JSON.stringify(exception)}`);
    }

    // ─── Réponse client (jamais de stack trace, jamais de détails techniques) ─
    response.status(status).json({
      statusCode: status,
      message,
      correlationId,
    });
  }
}
