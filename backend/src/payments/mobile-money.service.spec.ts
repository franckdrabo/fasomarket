import { LigdiCashService } from './ligdicash.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('LigdiCashService', () => {
  let service: LigdiCashService;
  let httpService: { post: jest.Mock; get: jest.Mock };

  beforeEach(() => {
    process.env.LIGDICASH_API_KEY = 'test-apikey';
    process.env.LIGDICASH_API_TOKEN = 'test-apitoken';
    process.env.LIGDICASH_CALLBACK_URL = 'https://api.fasomarket.com/api/v1/payments/webhook/ligdicash';
    process.env.LIGDICASH_RETURN_URL = 'https://fasomarket.com/paiement/succes';
    process.env.LIGDICASH_CANCEL_URL = 'https://fasomarket.com/paiement/annule';

    httpService = { post: jest.fn(), get: jest.fn() };
    service = new LigdiCashService(httpService as unknown as HttpService);
  });

  afterEach(() => {
    delete process.env.LIGDICASH_API_KEY;
    delete process.env.LIGDICASH_API_TOKEN;
    delete process.env.LIGDICASH_CALLBACK_URL;
    delete process.env.LIGDICASH_RETURN_URL;
    delete process.env.LIGDICASH_CANCEL_URL;
  });

  // ─── initiatePayment ──────────────────────────────────────────────────

  describe('initiatePayment', () => {
    it('devrait créer une facture et retourner une URL de paiement', async () => {
      httpService.post.mockReturnValue(of({
        data: {
          response_code: '00',
          token: 'eyJ0eXAiOiJKV1Qi',
          response_text: 'https://app.ligdicash.com/pay/invoice/eyJ0eXAiOiJKV1Qi',
        },
      }));

      const result = await service.initiatePayment({
        montant: 5000,
        telephone: '+2250102030405',
        reference: 'TX-001',
        description: 'Paiement test',
        operateur: 'ORANGE_MONEY',
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('ligdicash.com');
      expect(result.status).toBe('PENDING');
    });

    it('devrait retourner FAILED si la création échoue', async () => {
      httpService.post.mockReturnValue(of({
        data: {
          response_code: '01',
          response_text: 'Erreur de création',
        },
      }));

      const result = await service.initiatePayment({
        montant: 5000,
        telephone: '+2250102030405',
        reference: 'TX-002',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
    });

    it('devrait retourner FAILED en cas d\'erreur HTTP', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('network down')));

      const result = await service.initiatePayment({
        montant: 5000,
        telephone: '+2250102030405',
        reference: 'TX-003',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
    });

    it('devrait activer le mode simulation si les clés ne sont pas configurées', async () => {
      delete process.env.LIGDICASH_API_KEY;
      delete process.env.LIGDICASH_API_TOKEN;
      service = new LigdiCashService(httpService as unknown as HttpService);

      const result = await service.initiatePayment({
        montant: 5000,
        telephone: '+2250102030405',
        reference: 'TX-004',
      });

      expect(result.success).toBe(true);
      expect(result.providerReference).toContain('LC-');
      expect(result.message).toContain('simulé');
    });
  });

  // ─── processCallback ──────────────────────────────────────────────────

  describe('processCallback', () => {
    it('devrait extraire transaction_id depuis custom_data', async () => {
      httpService.get.mockReturnValue(of({ data: { status: 'completed' } }));

      const payload = {
        token: 'eyJ0eXAiOiJKV1Qi',
        custom_data: [
          { keyof_customdata: 'transaction_id', valueof_customdata: 'TX-001' },
          { keyof_customdata: 'operateur', valueof_customdata: 'ORANGE_MONEY' },
        ],
      };

      const result = await service.processCallback(payload);

      expect(result.reference).toBe('TX-001');
      expect(result.status).toBe('SUCCESS');
    });

    it('devrait retourner FAILED si transaction_id est absent', async () => {
      const payload = {
        token: 'eyJ0eXAiOiJKV1Qi',
        custom_data: [],
      };

      const result = await service.processCallback(payload);

      expect(result.reference).toBe('');
      expect(result.status).toBe('FAILED');
    });

    it('devrait propager PENDING si la re-vérification indique un paiement en cours', async () => {
      httpService.get.mockReturnValue(of({ data: { status: 'pending' } }));

      const payload = {
        token: 'eyJ0eXAiOiJKV1Qi',
        custom_data: [
          { keyof_customdata: 'transaction_id', valueof_customdata: 'TX-002' },
        ],
      };

      const result = await service.processCallback(payload);

      expect(result.status).toBe('PENDING');
    });

    it('devrait propager FAILED si la re-vérification indique un échec', async () => {
      httpService.get.mockReturnValue(of({ data: { status: 'cancelled' } }));

      const payload = {
        token: 'eyJ0eXAiOiJKV1Qi',
        custom_data: [
          { keyof_customdata: 'transaction_id', valueof_customdata: 'TX-003' },
        ],
      };

      const result = await service.processCallback(payload);

      expect(result.status).toBe('FAILED');
    });

    it('devrait retourner FAILED si la re-vérification HTTP échoue', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('network down')));

      const payload = {
        token: 'eyJ0eXAiOiJKV1Qi',
        custom_data: [
          { keyof_customdata: 'transaction_id', valueof_customdata: 'TX-004' },
        ],
      };

      const result = await service.processCallback(payload);

      expect(result.status).toBe('FAILED');
    });
  });
});
