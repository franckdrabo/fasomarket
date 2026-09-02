import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Service de paiement FedaPay (alternative à CinetPay)
 *
 * Avantages :
 *   - KYC plus souple (pas de RCCM/KBIS obligatoire)
 *   - Mode test disponible immédiatement
 *   - Couvre CI, SN, BJ, TG, NE
 *   - API simple et bien documentée
 *
 * Documentation : https://doc.fedapay.com
 * Dashboard : https://app.fedapay.com
 *
 * Configuration (env) :
 *   - FEDAPAY_PUBLIC_KEY  : Clé publique (pk_test_xxx ou pk_live_xxx)
 *   - FEDAPAY_SECRET_KEY  : Clé secrète (sk_test_xxx ou sk_live_xxx)
 *   - FEDAPAY_ENV         : 'test' ou 'production'
 */

export interface FedaPayPaymentRequest {
  montant: number;
  telephone: string;
  reference: string;
  description?: string;
  operateur?: string;
}

export interface FedaPayPaymentResult {
  success: boolean;
  providerReference?: string;
  paymentUrl?: string;
  message: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

// Mapping des opérateurs CinetPay → FedaPay
const OPERATOR_MAP: Record<string, string> = {
  ORANGE_MONEY: 'OM',
  MOOV_MONEY: 'FM',
  WAVE: 'WAVE',
};

@Injectable()
export class FedaPayService {
  readonly name = 'FEDAPAY';
  private readonly logger = new Logger(FedaPayService.name);
  private readonly baseUrl: string;
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly environment: string;

  constructor(private httpService: HttpService) {
    this.environment = process.env.FEDAPAY_ENV || 'test';
    this.baseUrl = this.environment === 'production'
      ? 'https://api.fedapay.com/v1'
      : 'https://api-sandbox.fedapay.com/v1';
    this.publicKey = process.env.FEDAPAY_PUBLIC_KEY || '';
    this.secretKey = process.env.FEDAPAY_SECRET_KEY || '';
  }

  private get isConfigured(): boolean {
    return Boolean(this.publicKey && this.secretKey);
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initiatePayment(request: FedaPayPaymentRequest): Promise<FedaPayPaymentResult> {
    this.logger.log(`💸 FedaPay: Paiement ${request.montant} FCFA (${request.operateur || 'ORANGE_MONEY'})`);

    if (!this.isConfigured) {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          message: 'Paiement indisponible (FEDAPAY_PUBLIC_KEY / FEDAPAY_SECRET_KEY non configurés)',
          status: 'FAILED',
        };
      }
      this.logger.warn('⚠️ FedaPay non configuré. Mode simulation activé.');
      return this.simulatePayment(request);
    }

    const operator = OPERATOR_MAP[request.operateur || 'ORANGE_MONEY'] || 'OM';

    try {
      // Étape 1 : Créer un token de paiement
      const tokenResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/tokens`,
          {
            amount: request.montant,
            currency: { iso: 'XOF' },
            description: request.description || 'Paiement FasoMarket',
            callback_url: process.env.FEDAPAY_CALLBACK_URL || '',
          },
          { headers: this.authHeaders },
        ),
      );

      const token = tokenResponse.data?.data?.token;
      if (!token) {
        return {
          success: false,
          message: `FedaPay: ${tokenResponse.data?.message || 'Erreur création token'}`,
          status: 'FAILED',
        };
      }

      // Étape 2 : Initier le paiement avec le token
      const paymentResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/payments`,
          {
            token,
            method: 'mobile_money',
            phone_number: request.telephone,
            operator: operator,
          },
          { headers: this.authHeaders },
        ),
      );

      const payment = paymentResponse.data?.data;
      if (!payment?.id) {
        return {
          success: false,
          message: `FedaPay: ${paymentResponse.data?.message || 'Erreur initiation paiement'}`,
          status: 'FAILED',
        };
      }

      return {
        success: true,
        providerReference: String(payment.id),
        paymentUrl: payment.payment_url || undefined,
        message: 'Paiement FedaPay initié. Confirmez sur votre téléphone.',
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ FedaPay error: ${error.message}`);
      return {
        success: false,
        message: `FedaPay: ${error.message}`,
        status: 'FAILED',
      };
    }
  }

  async checkStatus(providerReference: string): Promise<FedaPayPaymentResult> {
    if (!this.isConfigured) {
      if (process.env.NODE_ENV === 'production') {
        return { success: false, providerReference, message: 'Paiement indisponible', status: 'FAILED' };
      }
      this.logger.warn('⚠️ FedaPay non configuré. Statut simulé : SUCCESS');
      return { success: true, providerReference, message: 'Simulation : paiement confirmé', status: 'SUCCESS' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/payments/${providerReference}`,
          { headers: this.authHeaders },
        ),
      );

      const payment = response.data?.data;
      const status = payment?.status?.toUpperCase();

      if (status === 'APPROVED' || status === 'SUCCESS') {
        return { success: true, providerReference, message: 'Paiement confirmé', status: 'SUCCESS' };
      }
      if (status === 'PENDING' || status === 'PROCESSING') {
        return { success: false, providerReference, message: 'Paiement en cours', status: 'PENDING' };
      }
      return { success: false, providerReference, message: `Paiement ${status || 'échoué'}`, status: 'FAILED' };
    } catch (error: any) {
      this.logger.error(`❌ FedaPay status check error: ${error.message}`);
      return { success: false, message: 'Erreur vérification statut', status: 'FAILED' };
    }
  }

  async processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'PENDING' | 'FAILED'; providerReference: string }> {
    this.logger.debug('📞 FedaPay callback reçu:', payload);

    const transId = payload.data?.id || payload.transaction_id;
    if (!transId) {
      return { reference: '', status: 'FAILED', providerReference: '' };
    }

    const verified = await this.checkStatus(String(transId));
    return {
      reference: String(transId),
      status: verified.status,
      providerReference: String(transId),
    };
  }

  private async simulatePayment(_request: FedaPayPaymentRequest): Promise<FedaPayPaymentResult> {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      providerReference: `FP-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      message: '✅ Paiement FedaPay simulé avec succès',
      status: 'PENDING',
    };
  }
}
