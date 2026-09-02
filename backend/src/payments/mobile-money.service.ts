import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LigdiCashService } from './ligdicash.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MobileMoneyPaymentRequest {
  montant: number;
  telephone: string;
  reference: string;
  description?: string;
  /** Opérateur souhaité (ORANGE_MONEY | MOOV_MONEY | WAVE) */
  operateur?: string;
}

export interface MobileMoneyPaymentResult {
  success: boolean;
  providerReference?: string;
  /** URL de paiement hébergée (page LigdiCash) à ouvrir par le client */
  paymentUrl?: string;
  message: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface MobileMoneyProvider {
  readonly name: string;
  initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult>;
  checkStatus(providerReference: string): Promise<MobileMoneyPaymentResult>;
  processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'PENDING' | 'FAILED'; providerReference: string }>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

@Injectable()
export class MobileMoneyFactory {
  private readonly logger = new Logger(MobileMoneyFactory.name);

  constructor(
    private ligdiCashService: LigdiCashService,
  ) {}

  /**
   * Retourne le provider de paiement (LigdiCash = unique provider).
   */
  getProvider(_method: string): MobileMoneyProvider {
    return this.ligdiCashService;
  }

  getAvailableProviders(): string[] {
    return ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'];
  }
}
