import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MobileMoneyProvider, MobileMoneyPaymentRequest, MobileMoneyPaymentResult } from './mobile-money.service';

/**
 * Service de paiement LigdiCash (ex-LigdyPay)
 *
 * Passerelle de paiement Mobile Money pour l'Afrique de l'Ouest et Centrale.
 * Couvre : Burkina Faso, Mali, Niger, Bénin, Togo, Côte d'Ivoire, Sénégal, RD Congo, Guinée Conakry.
 * Opérateurs : Orange Money, Moov Money, MTN, Wave + cartes bancaires.
 *
 * Documentation : https://developers.ligdicash.com
 * Dashboard : https://app.ligdicash.com
 *
 * Configuration (env) :
 *   - LIGDICASH_API_KEY     : Clé API (Apikey header)
 *   - LIGDICASH_API_TOKEN   : Token d'authentification (Bearer token)
 *   - LIGDICASH_CALLBACK_URL: URL de callback pour les notifications de paiement
 *   - LIGDICASH_RETURN_URL  : URL de retour après paiement (succès/annulation)
 *   - LIGDICASH_CANCEL_URL  : URL d'annulation
 */

export interface LigdiCashPaymentRequest {
  montant: number;
  telephone: string;
  reference: string;
  description?: string;
  operateur?: string;
}

export interface LigdiCashPaymentResult {
  success: boolean;
  providerReference?: string;
  paymentUrl?: string;
  message: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

@Injectable()
export class LigdiCashService implements MobileMoneyProvider {
  readonly name = 'LIGDICASH';
  private readonly logger = new Logger(LigdiCashService.name);
  private readonly baseUrl = 'https://app.ligdicash.com';
  private readonly apiKey: string;
  private readonly apiToken: string;
  private readonly callbackUrl: string;
  private readonly returnUrl: string;
  private readonly cancelUrl: string;

  constructor(private httpService: HttpService) {
    this.apiKey = process.env.LIGDICASH_API_KEY || '';
    this.apiToken = process.env.LIGDICASH_API_TOKEN || '';
    this.callbackUrl = process.env.LIGDICASH_CALLBACK_URL || '';
    this.returnUrl = process.env.LIGDICASH_RETURN_URL || '';
    this.cancelUrl = process.env.LIGDICASH_CANCEL_URL || '';
  }

  private get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiToken);
  }

  private get authHeaders() {
    return {
      Apikey: this.apiKey,
      Authorization: `Bearer ${this.apiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    this.logger.log(`💸 LigdiCash: Paiement ${request.montant} FCFA (${request.operateur || 'ORANGE_MONEY'})`);

    if (!this.isConfigured) {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          message: 'Paiement indisponible (LIGDICASH_API_KEY / LIGDICASH_API_TOKEN non configurés)',
          status: 'FAILED',
        };
      }
      this.logger.warn('⚠️ LIGDICASH_API_KEY / LIGDICASH_API_TOKEN non configurés. Mode simulation activé.');
      return this.simulatePayment(request);
    }

    try {
      // Étape 1 : Créer la facture de paiement
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/pay/v01/redirect/checkout-invoice/create`,
          {
            commande: {
              invoice: {
                items: [
                  {
                    name: request.description?.substring(0, 100) || 'Paiement FasoMarket',
                    price: request.montant,
                    quantity: 1,
                  },
                ],
                total_amount: request.montant,
                devise: 'XOF',
                description: request.description || 'Paiement FasoMarket',
                customer: '',
                customer_firstname: '',
                customer_lastname: '',
                customer_email: '',
              },
              store: {
                name: 'FasoMarket',
                website_url: 'https://fasomarket.com',
              },
              actions: {
                cancel_url: this.cancelUrl || this.callbackUrl,
                return_url: this.returnUrl || this.callbackUrl,
                callback_url: this.callbackUrl,
              },
              custom_data: [
                {
                  keyof_customdata: 'transaction_id',
                  valueof_customdata: request.reference,
                },
                {
                  keyof_customdata: 'operateur',
                  valueof_customdata: request.operateur || 'ORANGE_MONEY',
                },
                {
                  keyof_customdata: 'telephone',
                  valueof_customdata: request.telephone,
                },
              ],
            },
          },
          { headers: this.authHeaders },
        ),
      );

      const data = response.data;

      // LigdiCash renvoie response_code "00" en cas de succès
      if (data.response_code !== '00') {
        this.logger.error(`❌ LigdiCash: ${data.response_text || 'Erreur création facture'}`);
        return {
          success: false,
          message: `LigdiCash: ${data.response_text || 'Erreur création facture'}`,
          status: 'FAILED',
        };
      }

      // Le token est nécessaire pour vérifier le statut ultérieurement
      const paymentUrl = data.response_text; // URL de la page de paiement
      const token = data.token;

      this.logger.log(`✅ LigdiCash facture créée, token: ${token?.substring(0, 20)}...`);

      return {
        success: true,
        providerReference: request.reference,
        paymentUrl,
        message: 'Paiement LigdiCash initié. Procédez au paiement sur la page sécurisée.',
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ LigdiCash error: ${error.message}`);
      return {
        success: false,
        message: `LigdiCash: ${error.message}`,
        status: 'FAILED',
      };
    }
  }

  async checkStatus(providerReference: string): Promise<MobileMoneyPaymentResult> {
    if (!this.isConfigured) {
      if (process.env.NODE_ENV === 'production') {
        return { success: false, providerReference, message: 'Paiement indisponible', status: 'FAILED' };
      }
      this.logger.warn('⚠️ LigdiCash non configuré. Statut simulé : SUCCESS');
      return { success: true, providerReference, message: 'Simulation : paiement confirmé', status: 'SUCCESS' };
    }

    // Pour LigdiCash, la vérification se fait via le token de la facture
    // Le token doit être stocké lors de la création et utilisé ici
    // Note: En production, il faudrait stocker le token LigdiCash en base
    this.logger.debug(`🔍 LigdiCash: vérification du statut pour ${providerReference}`);

    // Pour l'instant, on retourne PENDING car la vérification dépend du callback
    return { success: false, providerReference, message: 'En attente de confirmation', status: 'PENDING' };
  }

  async processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'PENDING' | 'FAILED'; providerReference: string }> {
    this.logger.debug('📞 LigdiCash callback reçu:', payload);

    // Extraire le transaction_id depuis custom_data
    const customData = payload.custom_data || [];
    const transactionEntry = customData.find(
      (item: any) => item.keyof_customdata === 'transaction_id',
    );
    const transactionId = transactionEntry?.valueof_customdata;

    if (!transactionId) {
      this.logger.warn('⚠️ LigdiCash callback sans transaction_id');
      return { reference: '', status: 'FAILED', providerReference: '' };
    }

    // Vérifier le statut via l'API LigdiCash
    const status = await this.verifyPaymentStatus(payload.token || transactionId);

    return {
      reference: transactionId,
      status,
      providerReference: transactionId,
    };
  }

  /**
   * Vérifie le statut d'un paiement via l'endpoint confirm de LigdiCash
   */
  private async verifyPaymentStatus(token: string): Promise<'SUCCESS' | 'PENDING' | 'FAILED'> {
    if (!this.isConfigured) {
      return 'PENDING';
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/pay/v01/redirect/checkout-invoice/confirm/?invoiceToken=${token}`,
          { headers: this.authHeaders },
        ),
      );

      const status = response.data?.status;

      if (status === 'completed') {
        return 'SUCCESS';
      }
      if (status === 'pending' || status === 'processing') {
        return 'PENDING';
      }
      return 'FAILED';
    } catch (error: any) {
      this.logger.error(`❌ LigdiCash status check error: ${error.message}`);
      return 'FAILED';
    }
  }

  private async simulatePayment(_request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      providerReference: `LC-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      message: '✅ Paiement LigdiCash simulé avec succès',
      status: 'PENDING',
    };
  }
}
