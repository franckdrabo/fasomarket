import { UnauthorizedException } from '@nestjs/common';
import { CinetPayService } from './mobile-money.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('CinetPayService', () => {
  let service: CinetPayService;
  let httpService: { post: jest.Mock };

  const SITE_ID = '845632';

  beforeEach(() => {
    process.env.CINETPAY_API_KEY = 'test-apikey';
    process.env.CINETPAY_SITE_ID = SITE_ID;
    process.env.CINETPAY_API_URL = 'https://api-checkout.cinetpay.com';
    process.env.CINETPAY_NOTIFY_URL = 'https://api.fasomarket.com/api/v1/payments/webhook/cinetpay';

    httpService = { post: jest.fn() };
    service = new CinetPayService(httpService as unknown as HttpService);
  });

  afterEach(() => {
    delete process.env.CINETPAY_API_KEY;
    delete process.env.CINETPAY_SITE_ID;
    delete process.env.CINETPAY_API_URL;
    delete process.env.CINETPAY_NOTIFY_URL;
  });

  // ─── checkStatus : classification des codes CinetPay v1 ─────────────────

  describe('checkStatus', () => {
    it("devrait retourner SUCCESS pour le code '00' (paiement validé)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '00', message: 'SUCCES' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('SUCCESS');
      expect(result.success).toBe(true);
    });

    it("devrait retourner PENDING pour un code en attente (ex: 662 WAITING_CUSTOMER_PAYMENT)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '662', message: 'WAITING_CUSTOMER_PAYMENT' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('PENDING');
      expect(result.success).toBe(false);
    });

    it("devrait retourner PENDING pour le code 663 (WAITING_CUSTOMER_OTP_CODE)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '663', message: 'WAITING_CUSTOMER_OTP_CODE' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('PENDING');
    });

    it("devrait retourner PENDING pour le code 201 (CREATED)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '201', message: 'CREATED' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('PENDING');
    });

    it("devrait retourner FAILED pour le code 600 (PAYMENT_FAILED — refus définitif)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '600', message: 'PAYMENT_FAILED' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('FAILED');
      expect(result.success).toBe(false);
    });

    it("devrait retourner FAILED pour le code 602 (INSUFFICIENT_BALANCE)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '602', message: 'INSUFFICIENT_BALANCE' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('FAILED');
    });

    it("devrait retourner FAILED pour le code 627 (TRANSACTION_CANCEL)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '627', message: 'TRANSACTION_CANCEL' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('FAILED');
    });

    it("devrait retourner FAILED pour un code inconnu (défaut conservateur)", async () => {
      httpService.post.mockReturnValue(of({ data: { code: '999', message: 'UNKNOWN' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('FAILED');
    });

    it('devrait retourner FAILED en cas de réponse sans code', async () => {
      httpService.post.mockReturnValue(of({ data: { message: 'rien' } }));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('FAILED');
    });

    it('devrait retourner FAILED si la requête HTTP échoue (erreur transport)', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('network down')));

      const result = await service.checkStatus('T1');

      expect(result.status).toBe('FAILED');
    });
  });

  // ─── processCallback ─────────────────────────────────────────────────────

  describe('processCallback', () => {
    it('devrait rejeter un callback dont cpm_site_id ne correspond pas au nôtre', async () => {
      const payload = { cpm_site_id: '999999', cpm_trans_id: 'T1' };
      await expect(service.processCallback(payload)).rejects.toThrow(UnauthorizedException);
      // Aucune requête serveur ne doit être déclenchée
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('devrait rejeter un callback SANS cpm_site_id (contournement anti-spoofing)', async () => {
      const payload = { cpm_trans_id: 'T1' };
      await expect(service.processCallback(payload)).rejects.toThrow(UnauthorizedException);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('devrait accepter un callback avec le bon cpm_site_id et re-vérifier côté serveur (succès)', async () => {
      httpService.post.mockReturnValue(of({ data: { code: '00', message: 'SUCCESS' } }));
      const payload = { cpm_site_id: SITE_ID, cpm_trans_id: 'T1' };

      const result = await service.processCallback(payload);

      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        reference: 'T1',
        status: 'SUCCESS',
        providerReference: 'T1',
      });
    });

    it('devrait propager PENDING si la re-vérification serveur indique un paiement en cours (code 662)', async () => {
      httpService.post.mockReturnValue(of({ data: { code: '662', message: 'WAITING_CUSTOMER_PAYMENT' } }));
      const payload = { cpm_site_id: SITE_ID, cpm_trans_id: 'T1' };

      const result = await service.processCallback(payload);

      expect(result.status).toBe('PENDING');
    });

    it('devrait propager FAILED si la re-vérification serveur indique un échec définitif (code 600)', async () => {
      httpService.post.mockReturnValue(of({ data: { code: '600', message: 'PAYMENT_FAILED' } }));
      const payload = { cpm_site_id: SITE_ID, cpm_trans_id: 'T1' };

      const result = await service.processCallback(payload);

      expect(result.status).toBe('FAILED');
    });

    it('devrait retourner FAILED si la re-vérification serveur échoue (erreur transport)', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('network down')));
      const payload = { cpm_site_id: SITE_ID, cpm_trans_id: 'T1' };

      const result = await service.processCallback(payload);

      expect(result.status).toBe('FAILED');
    });

    it('devrait retourner une référence vide si cpm_trans_id est absent (callback non traitable)', async () => {
      const payload = { cpm_site_id: SITE_ID };
      const result = await service.processCallback(payload);
      expect(result).toEqual({ reference: '', status: 'FAILED', providerReference: '' });
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });
});
