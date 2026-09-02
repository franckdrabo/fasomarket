import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FedaPayService } from './fedapay.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MobileMoneyPaymentRequest {
  montant: number;
  telephone: string;
  reference: string;
  description?: string;
  /** Opérateur souhaité (ORANGE_MONEY | MOOV_MONEY | WAVE) — utilisé par CinetPay */
  operateur?: string;
}

export interface MobileMoneyPaymentResult {
  success: boolean;
  providerReference?: string;
  /** URL de paiement hébergée (page CinetPay) à ouvrir par le client */
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

// ─── CinetPay (agrégateur Orange Money / Moov Money / Wave) ─────────────────
// Une seule intégration couvre les trois opérateurs via cpm_payment_config.
// Documentation : https://api-checkout.cinetpay.com  (v1)

const CINETPAY_OPERATOR_CONFIG: Record<string, string> = {
  ORANGE_MONEY: 'ORANGE_CI',
  MOOV_MONEY: 'MOOV_CI',
  WAVE: 'WAVE_CI',
};

// ─── Codes de statut CinetPay v1 (tableau officiel) ─────────────────────────
// Docs : https://docs.cinetpay.com/api/1.0-en/checkout/tableau
// Le endpoint /v1/payment/check répond { code, message, data }.
//
//   '00'  → SUCCESS : paiement validé (data.status = ACCEPTED)
//   Codes « en attente » → PENDING : le client / l'opérateur n'a pas encore
//     finalisé ; la transaction PEUT encore aboutir → aucune action définitive.
//   Tous les autres codes → FAILED : échec définitif (refus, solde insuffisant,
//     annulation, expiration…).
const CINETPAY_CODE_SUCCESS = '00';

/**
 * Codes CinetPay v1 signifiant que le paiement est encore en cours
 * (aucune décision définitive à prendre).
 *  - 201 : CREATED — transaction créée, en attente du client
 *  - 604 : OTP_CODE_ERROR — code OTP erroné, le client peut ressaisir
 *  - 623 : WAITING_CUSTOMER_TO_VALIDATE
 *  - 662 : WAITING_CUSTOMER_PAYMENT
 *  - 663 : WAITING_CUSTOMER_OTP_CODE
 *  - 664 : WAITING_CUSTOMER_PAYMENT_AT_OPERATOR_SIDE
 */
const CINETPAY_PENDING_CODES = new Set<string>([
  '201',
  '604',
  '623',
  '662',
  '663',
  '664',
]);

/**
 * Libellés lisibles pour les codes d'échec les plus courants
 * (utilisés dans le message renvoyé à l'utilisateur).
 */
const CINETPAY_FAILURE_LABELS: Record<string, string> = {
  '600': 'Paiement refusé par votre opérateur',
  '602': 'Solde insuffisant',
  '603': 'Service de paiement temporairement indisponible',
  '620': 'Paiement en double détecté',
  '625': 'Paiement expiré',
  '627': 'Paiement annulé',
  '804': 'Opérateur indisponible',
};

@Injectable()
export class CinetPayService implements MobileMoneyProvider {
  readonly name = 'CINETPAY';
  private readonly logger = new Logger(CinetPayService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly siteId: string;
  private readonly notifyUrl: string;

  constructor(private httpService: HttpService) {
    this.baseUrl = process.env.CINETPAY_API_URL || 'https://api-checkout.cinetpay.com';
    this.apiKey = process.env.CINETPAY_API_KEY || '';
    this.siteId = process.env.CINETPAY_SITE_ID || '';
    this.notifyUrl = process.env.CINETPAY_NOTIFY_URL || '';
  }

  private get isConfigured(): boolean {
    return Boolean(this.apiKey && this.siteId);
  }

  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    this.logger.log(`💸 CinetPay: Paiement ${request.montant} FCFA (${request.operateur || 'ORANGE_MONEY'})`);

    if (!this.isConfigured) {
      // En production, sans clé API, aucun vrai paiement ne peut être initié
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          message: 'Paiement indisponible (CINETPAY_API_KEY / CINETPAY_SITE_ID non configurés)',
          status: 'FAILED',
        };
      }
      this.logger.warn('⚠️ CINETPAY_API_KEY / CINETPAY_SITE_ID non configurés. Mode simulation activé.');
      return this.simulatePayment(request);
    }

    const operatorConfig = CINETPAY_OPERATOR_CONFIG[request.operateur || 'ORANGE_MONEY'] || 'ORANGE_CI';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/payment`,
          {
            apikey: this.apiKey,
            site_id: this.siteId,
            cpm_site_id: this.siteId,
            cpm_amount: request.montant,
            cpm_currency: 'XOF',
            cpm_trans_id: request.reference,
            cpm_designation: request.description || 'Paiement Bazario',
            cpm_language: 'fr',
            cpm_phone: request.telephone,
            cpm_payment_config: operatorConfig,
            cpm_custom: request.reference,
            notify_url: this.notifyUrl,
            return_url: this.notifyUrl,
            cancel_url: this.notifyUrl,
          },
        ),
      );

      const data = response.data?.data || response.data;
      if (!data?.payment_url) {
        return {
          success: false,
          message: `CinetPay: ${data?.message || 'réponse invalide'}`,
          status: 'FAILED',
        };
      }

      // providerReference = notre cpm_trans_id (référence Bazario), PAS le token
      // CinetPay : l'endpoint /v1/payment/check s'interroge avec cpm_trans_id,
      // donc le round-trip (init → confirm) doit rester sur notre référence.
      return {
        success: true,
        providerReference: request.reference,
        paymentUrl: data.payment_url,
        message: 'Paiement CinetPay initié. Procédez au paiement sur la page sécurisée.',
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(`❌ CinetPay error: ${error.message}`);
      return {
        success: false,
        message: `CinetPay: ${error.message}`,
        status: 'FAILED',
      };
    }
  }

  async checkStatus(providerReference: string): Promise<MobileMoneyPaymentResult> {
    if (!this.isConfigured) {
      // La simulation n'est autorisée qu'en développement.
      if (process.env.NODE_ENV === 'production') {
        return { success: false, providerReference, message: 'Paiement indisponible (clé API manquante)', status: 'FAILED' };
      }
      this.logger.warn('⚠️ CINETPAY non configuré. Statut simulé : SUCCESS');
      return { success: true, providerReference, message: 'Simulation : paiement confirmé', status: 'SUCCESS' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/v1/payment/check`, {
          apikey: this.apiKey,
          site_id: this.siteId,
          cpm_trans_id: providerReference,
        }),
      );

      // ─── Classification des codes CinetPay v1 (tableau officiel) ──────────
      // Endpoint /v1/payment/check → { code, message, data }. Seul le code
      // '00' signifie paiement confirmé. Les codes « en attente » indiquent que
      // le client / l'opérateur n'a pas encore finalisé (la transaction peut
      // encore aboutir) → PENDING. Tous les autres codes documentés sont des
      // échecs DÉFINITIFS (refus, solde insuffisant, annulation, expiration…) →
      // FAILED, pour ne pas laisser une transaction bloquée indéfiniment.
      const code = String(response.data?.code ?? '');
      const message = `Statut: ${response.data?.message || code}`;

      if (code === CINETPAY_CODE_SUCCESS) {
        return { success: true, providerReference, message, status: 'SUCCESS' };
      }
      if (CINETPAY_PENDING_CODES.has(code)) {
        this.logger.debug(`⏳ CinetPay: paiement en attente (code ${code}) pour ${providerReference}`);
        return { success: false, providerReference, message, status: 'PENDING' };
      }
      // Échec définitif (ou code inconnu → défaut conservateur FAILED).
      // Auto-cicatrisation : si le paiement aboutissait quand même plus tard,
      // CinetPay renverra un nouveau callback SUCCESS qui repassera la
      // transaction en BLOQUE (handleProviderCallback). Un code inconnu n'est
      // donc jamais un blocage définitif, et il vaut mieux libérer l'utilisateur
      // (réessai) qu'un faux PENDING qui le laisserait coincé.
      const friendlyLabel = CINETPAY_FAILURE_LABELS[code] || message;
      this.logger.warn(`❌ CinetPay: échec définitif (code ${code}) pour ${providerReference}`);
      return { success: false, providerReference, message: friendlyLabel, status: 'FAILED' };
    } catch (error: any) {
      this.logger.error(`❌ CinetPay status check error: ${error.message}`);
      return { success: false, message: 'Erreur vérification statut', status: 'FAILED' };
    }
  }

  /**
   * Vérifie un callback CinetPay.
   * Bonne pratique CinetPay : ne JAMAIS se fier au payload reçu en clair —
   * on re-vérifie le statut côté serveur via /v1/payment/check.
   *
   * Anti-spoofing : on rejette tout callback dont cpm_site_id ne correspond
   * pas à NOTRE site_id (un attaquant ne peut donc pas injecter un callback
   * « au nom d'un autre marchand » ni rejouer un callback d'un autre site).
   */
  async processCallback(payload: any): Promise<{ reference: string; status: 'SUCCESS' | 'PENDING' | 'FAILED'; providerReference: string }> {
    this.logger.debug('📞 CinetPay callback reçu:', payload);

    // Le callback doit provenir de NOTRE compte CinetPay. Quand site_id est
    // configuré, un callback qui l'omet est tout aussi suspect qu'un mauvais
    // site_id → rejeté (anti-spoofing).
    if (this.siteId && String(payload.cpm_site_id ?? '') !== String(this.siteId)) {
      this.logger.warn(`🚫 Callback rejeté : cpm_site_id invalide ou absent (reçu: ${payload.cpm_site_id ?? 'absent'})`);
      throw new UnauthorizedException('Callback CinetPay non authentique (cpm_site_id invalide)');
    }

    const transId = payload.cpm_trans_id || payload.transactionId;
    if (!transId) {
      return { reference: '', status: 'FAILED', providerReference: '' };
    }

    // Le statut serveur fait autorité. On PROPAGE le statut réel (SUCCESS /
    // PENDING / FAILED) : un paiement encore en cours (PENDING) ne doit PAS
    // être traité comme un échec définitif (CinetPay réessaie ses callbacks).
    const verified = await this.checkStatus(transId);
    return {
      reference: transId,
      status: verified.status,
      providerReference: transId,
    };
  }

  private async simulatePayment(_request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      providerReference: `CP-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      message: '✅ Paiement CinetPay simulé avec succès',
      status: 'PENDING',
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

@Injectable()
export class MobileMoneyFactory {
  private readonly logger = new Logger(MobileMoneyFactory.name);

  constructor(
    private cinetPayService: CinetPayService,
    private fedapayService: FedaPayService,
  ) {}

  /**
   * Retourne le provider de paiement selon la méthode choisie.
   * Par défaut, utilise FedaPay si configuré (KYC plus souple),
   * sinon CinetPay.
   */
  getProvider(method: string): MobileMoneyProvider {
    // Si FedaPay est configuré, l'utiliser par défaut
    const useFedaPay = process.env.FEDAPAY_PUBLIC_KEY && process.env.FEDAPAY_SECRET_KEY;

    switch (method) {
      case 'ORANGE_MONEY':
      case 'MOOV_MONEY':
      case 'WAVE':
        return useFedaPay ? this.fedapayService : this.cinetPayService;
      case 'FEDAPAY':
        return this.fedapayService;
      case 'CINETPAY':
        return this.cinetPayService;
      default:
        throw new BadRequestException(`Moyen de paiement non supporté: ${method}`);
    }
  }

  getAvailableProviders(): string[] {
    return ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'];
  }
}
