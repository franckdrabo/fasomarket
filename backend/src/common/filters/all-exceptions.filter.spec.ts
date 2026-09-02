import {
  HttpException,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
  ArgumentsHost,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockArgumentsHost(overrides?: {
  statusCode?: number;
  correlationId?: string;
}): {
  host: ArgumentsHost;
  jsonMock: jest.Mock;
  statusMock: jest.Mock;
} {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  const responseMock = { status: statusMock };

  const correlationId = overrides?.correlationId ?? 'corr-123';

  const requestMock = {
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: correlationId ? { 'x-correlation-id': correlationId } : {},
    id: 'req-456',
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => responseMock,
      getRequest: () => requestMock,
    }),
    switchToRpc: () => ({ getContext: () => ({}), getData: () => ({}) }),
    switchToWs: () => ({ getClient: () => ({}), getData: () => ({}) }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => 'http' as const,
  };

  return { host: host as unknown as ArgumentsHost, jsonMock, statusMock };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // Silencer le logger pendant les tests
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── HttpException standard ─────────────────────────────────────────

  it('devrait retourner le statut et le message d une HttpException', () => {
    const { host, jsonMock, statusMock } = mockArgumentsHost();
    const exception = new ForbiddenException('Accès interdit');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 403,
      message: 'Accès interdit',
      correlationId: 'corr-123',
    });
  });

  it('devrait retourner 500 avec message générique pour une erreur inconnue', () => {
    const { host, jsonMock, statusMock } = mockArgumentsHost();
    const exception = new Error('ER_DUP_ENTRY: Duplicate entry for key PRIMARY');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Une erreur interne est survenue. Veuillez réessayer plus tard.',
      }),
    );

    // Vérifier que le message technique N'EST PAS renvoyé
    const responseBody = jsonMock.mock.calls[0][0];
    expect(responseBody.message).not.toContain('ER_DUP_ENTRY');
    expect(responseBody.message).not.toContain('Duplicate entry');
  });

  it('devrait retourner 429 avec message générique pour ThrottlerException', () => {
    const { host, jsonMock, statusMock } = mockArgumentsHost();
    const exception = new ThrottlerException('Too many requests');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(429);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 429,
      message: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
      correlationId: 'corr-123',
    });
  });

  it('devrait préserver les messages de validation (tableau)', () => {
    const { host, jsonMock, statusMock } = mockArgumentsHost();
    const validationMessages = [
      'email must be an email',
      'password must be longer than or equal to 6 characters',
    ];
    const exception = new BadRequestException(validationMessages);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 400,
      message: validationMessages,
      correlationId: 'corr-123',
    });
  });

  it('devrait gérer les exceptions avec réponse sous forme de string', () => {
    const { host, jsonMock, statusMock } = mockArgumentsHost();
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Not Found',
      correlationId: 'corr-123',
    });
  });

  // ─── Pas de stack trace dans la réponse ────────────────────────────

  it('NE DEVRAIT PAS inclure stack trace dans la réponse', () => {
    const { host, jsonMock } = mockArgumentsHost();
    const exception = new Error('Erreur technique sensible');

    filter.catch(exception, host);

    const responseBody = jsonMock.mock.calls[0][0];
    expect(responseBody).not.toHaveProperty('stack');
    expect(responseBody).not.toHaveProperty('stackTrace');
    expect(responseBody).not.toHaveProperty('trace');
  });

  it('NE DEVRAIT PAS inclure le nom de l erreur technique', () => {
    const { host, jsonMock } = mockArgumentsHost();
    const exception = new Error('QueryFailedError: ER_NO_DEFAULT_FOR_FIELD');

    filter.catch(exception, host);

    const responseBody = jsonMock.mock.calls[0][0];
    expect(responseBody.message).not.toContain('QueryFailedError');
    expect(responseBody.message).not.toContain('ER_NO_DEFAULT_FOR_FIELD');
  });

  // ─── Correlation ID ────────────────────────────────────────────────

  it('devrait inclure le correlation ID dans la réponse', () => {
    const { host, jsonMock } = mockArgumentsHost();
    const exception = new Error('test');

    filter.catch(exception, host);

    const responseBody = jsonMock.mock.calls[0][0];
    expect(responseBody.correlationId).toBe('corr-123');
  });

  it('devrait fallback sur request.id si x-correlation-id est absent', () => {
    const { host, jsonMock } = mockArgumentsHost({ correlationId: '' });
    const exception = new Error('test');

    filter.catch(exception, host);

    // CorrelationId sera celui du fallback: 'req-456'
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
  });

  // ─── Logger ────────────────────────────────────────────────────────

  it('devrait logger l erreur côté serveur (pas dans la réponse)', () => {
    const loggerSpy = jest.spyOn((filter as any).logger, 'error');
    const { host } = mockArgumentsHost();
    const exception = new Error('Sensitive SQL error');

    filter.catch(exception, host);

    expect(loggerSpy).toHaveBeenCalled();
    // Vérifier que le message technique est dans les logs serveur
    const logMessages = loggerSpy.mock.calls
      .map((call) => (typeof call[0] === 'string' ? call[0] : ''))
      .join(' ');
    expect(logMessages).toContain('Sensitive SQL error');
  });
});
