import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MobileMoneyPaymentRequest {
  montant: number;
  telephone: string;
  reference: string;
  description?: string;
}

export interface MobileMoneyPaymentResult {
  success: boolean;
  providerReference?: string;
  message: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface MobileMoneyProvider {
  readonly name: string;
  initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult>;
  checkStatus(providerReference: string): Promise<MobileMoneyPaymentResult>;
  processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'FAILED'; providerReference: string }>;
}

// ─── Orange Money ─────────────────────────────────────────────────────────────

@Injectable()
export class OrangeMoneyService implements MobileMoneyProvider {
  readonly name = 'ORANGE_MONEY';
  private readonly logger = new Logger(OrangeMoneyService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private httpService: HttpService) {
    this.baseUrl = process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com/money/v1';
    this.apiKey = process.env.ORANGE_MONEY_API_KEY || '';
  }

  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    this.logger.log(`💸 Orange Money: Paiement ${request.montant} FCFA vers ${request.telephone}`);

    if (!this.apiKey) {
      this.logger.warn('⚠️ ORANGE_MONEY_API_KEY non configurée. Mode simulation activé.');
      return this.simulatePayment(request);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/payments`,
          {
            amount: { value: request.montant, unit: 'FCFA' },
            receiver: { phone: request.telephone },
            reference: request.reference,
            description: request.description || 'Paiement Bazario',
          },
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        ),
      );
      return {
        success: true,
        providerReference: response.data.id,
        message: 'Paiement Orange Money initié',
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ Orange Money error: ${error.message}`);
      return {
        success: false,
        message: `Orange Money: ${error.message}`,
        status: 'FAILED',
      };
    }
  }

  async checkStatus(providerReference: string): Promise<MobileMoneyPaymentResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/payments/${providerReference}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }),
      );
      return {
        success: response.data.status === 'SUCCESSFUL',
        providerReference,
        message: `Statut: ${response.data.status}`,
        status: response.data.status === 'SUCCESSFUL' ? 'SUCCESS' : 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ Orange Money status check error: ${error.message}`);
      return { success: false, message: 'Erreur vérification statut', status: 'FAILED' };
    }
  }

  async processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'FAILED'; providerReference: string }> {
    this.logger.debug('📞 Orange Money callback reçu:', payload);
    return {
      reference: payload.reference || payload.transactionId,
      status: payload.status === 'SUCCESSFUL' ? 'SUCCESS' : 'FAILED',
      providerReference: payload.id || payload.transactionId,
    };
  }

  private async simulatePayment(_request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      providerReference: `OR-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      message: '✅ Paiement Orange Money simulé avec succès',
      status: 'PENDING',
    };
  }
}

// ─── Moov Money ──────────────────────────────────────────────────────────────

@Injectable()
export class MoovMoneyService implements MobileMoneyProvider {
  readonly name = 'MOOV_MONEY';
  private readonly logger = new Logger(MoovMoneyService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private httpService: HttpService) {
    this.baseUrl = process.env.MOOV_MONEY_API_URL || 'https://api.moov.africa/money/v1';
    this.apiKey = process.env.MOOV_MONEY_API_KEY || '';
  }

  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    this.logger.log(`💸 Moov Money: Paiement ${request.montant} FCFA vers ${request.telephone}`);

    if (!this.apiKey) {
      this.logger.warn('⚠️ MOOV_MONEY_API_KEY non configurée. Mode simulation activé.');
      return this.simulatePayment(request);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/collections`,
          {
            amount: request.montant,
            currency: 'XOF',
            phone: request.telephone,
            reference: request.reference,
            description: request.description || 'Paiement Bazario',
          },
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        ),
      );
      return {
        success: true,
        providerReference: response.data.transactionId,
        message: 'Paiement Moov Money initié',
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ Moov Money error: ${error.message}`);
      return {
        success: false,
        message: `Moov Money: ${error.message}`,
        status: 'FAILED',
      };
    }
  }

  async checkStatus(providerReference: string): Promise<MobileMoneyPaymentResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/collections/${providerReference}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }),
      );
      return {
        success: response.data.status === 'COMPLETED',
        providerReference,
        message: `Statut: ${response.data.status}`,
        status: response.data.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ Moov Money status check error: ${error.message}`);
      return { success: false, message: 'Erreur vérification statut', status: 'FAILED' };
    }
  }

  async processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'FAILED'; providerReference: string }> {
    this.logger.debug('📞 Moov Money callback reçu:', payload);
    return {
      reference: payload.reference || payload.externalRef,
      status: payload.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
      providerReference: payload.transactionId || payload.id,
    };
  }

  private async simulatePayment(_request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      providerReference: `MOOV-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      message: '✅ Paiement Moov Money simulé avec succès',
      status: 'PENDING',
    };
  }
}

// ─── Wave ────────────────────────────────────────────────────────────────────

@Injectable()
export class WaveMoneyService implements MobileMoneyProvider {
  readonly name = 'WAVE';
  private readonly logger = new Logger(WaveMoneyService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private httpService: HttpService) {
    this.baseUrl = process.env.WAVE_API_URL || 'https://api.wave.com/v1';
    this.apiKey = process.env.WAVE_API_KEY || '';
  }

  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    this.logger.log(`💸 Wave: Paiement ${request.montant} FCFA vers ${request.telephone}`);

    if (!this.apiKey) {
      this.logger.warn('⚠️ WAVE_API_KEY non configurée. Mode simulation activé.');
      return this.simulatePayment(request);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/payouts`,
          {
            amount: request.montant,
            currency: 'XOF',
            mobile: request.telephone,
            reference: request.reference,
            note: request.description || 'Paiement Bazario',
          },
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        ),
      );
      return {
        success: true,
        providerReference: response.data.id,
        message: 'Paiement Wave initié',
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ Wave error: ${error.message}`);
      return {
        success: false,
        message: `Wave: ${error.message}`,
        status: 'FAILED',
      };
    }
  }

  async checkStatus(providerReference: string): Promise<MobileMoneyPaymentResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/payouts/${providerReference}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }),
      );
      return {
        success: response.data.status === 'completed',
        providerReference,
        message: `Statut: ${response.data.status}`,
        status: response.data.status === 'completed' ? 'SUCCESS' : 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ Wave status check error: ${error.message}`);
      return { success: false, message: 'Erreur vérification statut', status: 'FAILED' };
    }
  }

  async processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'FAILED'; providerReference: string }> {
    this.logger.debug('📞 Wave callback reçu:', payload);
    return {
      reference: payload.reference || payload.clientReference,
      status: payload.event === 'payment.successful' ? 'SUCCESS' : 'FAILED',
      providerReference: payload.id || payload.payoutId,
    };
  }

  private async simulatePayment(_request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      providerReference: `WAVE-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      message: '✅ Paiement Wave simulé avec succès',
      status: 'PENDING',
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

@Injectable()
export class MobileMoneyFactory {
  private readonly logger = new Logger(MobileMoneyFactory.name);

  constructor(
    private orangeMoneyService: OrangeMoneyService,
    private moovMoneyService: MoovMoneyService,
    private waveMoneyService: WaveMoneyService,
  ) {}

  getProvider(method: string): MobileMoneyProvider {
    switch (method) {
      case 'ORANGE_MONEY':
        return this.orangeMoneyService;
      case 'MOOV_MONEY':
        return this.moovMoneyService;
      case 'WAVE':
        return this.waveMoneyService;
      default:
        throw new BadRequestException(`Moyen de paiement non supporté: ${method}`);
    }
  }

  getAvailableProviders(): string[] {
    return ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'];
  }
}
