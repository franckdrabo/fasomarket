import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;
  let httpService: HttpService;

  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    // Réinitialiser la config Africastalking entre chaque test
    delete process.env.AT_USERNAME;
    delete process.env.AT_API_KEY;
    delete process.env.AT_SENDER_ID;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: HttpService,
          useValue: { post: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  // ─── sendSms ───────────────────────────────────────────────────────────

  describe('sendSms', () => {
    it("devrait simuler (retourner false) en dev si Africastalking n'est pas configuré", async () => {
      const sent = await service.sendSms('+2250708091011', 'Bonjour');

      expect(sent).toBe(false);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('devrait retourner false en production sans clé API (aucun envoi)', async () => {
      process.env.NODE_ENV = 'production';

      const sent = await service.sendSms('+2250708091011', 'Bonjour');

      expect(sent).toBe(false);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it("devrait envoyer via Africastalking quand configuré (avec sender ID)", async () => {
      process.env.AT_USERNAME = 'bazario';
      process.env.AT_API_KEY = 'test-key';
      process.env.AT_SENDER_ID = 'BAZARIO';
      (httpService.post as jest.Mock).mockReturnValue(
        of({ data: { SMSMessageData: { Recipients: [{ status: 'Success' }] } } }),
      );

      const sent = await service.sendSms('+2250708091011', 'Code: 123456');

      expect(sent).toBe(true);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.africastalking.com/version1/messaging',
        'username=bazario&to=%2B2250708091011&message=Code%3A+123456&from=BAZARIO',
        expect.objectContaining({
          headers: expect.objectContaining({
            apiKey: 'test-key',
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('devrait envoyer sans from si aucun AT_SENDER_ID', async () => {
      process.env.AT_USERNAME = 'bazario';
      process.env.AT_API_KEY = 'test-key';
      (httpService.post as jest.Mock).mockReturnValue(of({} as any));

      await service.sendSms('+2250708091011', 'Test');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.africastalking.com/version1/messaging',
        'username=bazario&to=%2B2250708091011&message=Test',
        expect.anything(),
      );
    });

    it("devrait retourner false si l'appel HTTP échoue", async () => {
      process.env.AT_USERNAME = 'bazario';
      process.env.AT_API_KEY = 'test-key';
      (httpService.post as jest.Mock).mockReturnValue(
        throwError(() => new Error('API down')),
      );

      const sent = await service.sendSms('+2250708091011', 'Test');

      expect(sent).toBe(false);
    });
  });

  // ─── sendOtpCode ───────────────────────────────────────────────────────

  describe('sendOtpCode', () => {
    it('devrait construire un message contenant le code OTP', async () => {
      process.env.AT_USERNAME = 'bazario';
      process.env.AT_API_KEY = 'test-key';
      (httpService.post as jest.Mock).mockReturnValue(of({} as any));

      await service.sendOtpCode('+2250708091011', '123456');

      const body = (httpService.post as jest.Mock).mock.calls[0][1] as string;
      expect(body).toContain('123456');
      expect(body).toContain('to=%2B2250708091011');
    });
  });
});
