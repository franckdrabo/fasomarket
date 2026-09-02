import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Service d'envoi de SMS transactionnels (codes OTP) via Africastalking.
 *
 * Configuration (env) :
 *   - AT_USERNAME             : nom d'utilisateur du compte Africastalking
 *                               (obligatoire pour envoyer)
 *   - AT_API_KEY              : clé API Africastalking (obligatoire)
 *   - AT_SENDER_ID            : identifiant d'expéditeur validé (optionnel,
 *                               ex: "BAZARIO" — sinon l'expéditeur par défaut
 *                               du compte est utilisé). NB : les Sender ID
 *                               alphanumériques exigent généralement une
 *                               approbation en production.
 *
 * Comportement :
 *   - En développement / sans clé : envoi SIMULÉ (log uniquement), retourne false.
 *   - En production : retourne false si non configuré ou si l'envoi échoue
 *     (le caller décide de bloquer ou non).
 *
 *   - AT_API_URL (optionnel) : permet de pointer vers le sandbox
 *     (https://api.sandbox.africastalking.com) pour tester gratuitement.
 */

const AT_BASE_URL =
  process.env.AT_API_URL || 'https://api.africastalking.com/version1/messaging';

/** Masque un numéro pour les logs (pas de PII) */
function maskPhone(phone: string): string {
  if (!phone) return '';
  if (phone.length <= 7) return phone.slice(0, 2) + '****';
  return phone.slice(0, 7) + '****';
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Envoie un SMS transactionnel via l'API Africastalking.
   * @returns true si le message a été accepté par Africastalking, false sinon (ou simulé).
   */
  async sendSms(phone: string, text: string): Promise<boolean> {
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;
    const senderId = process.env.AT_SENDER_ID;

    if (!username || !apiKey) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          '❌ SMS non envoyé : AT_USERNAME / AT_API_KEY manquants',
        );
      } else {
        this.logger.warn(
          `⚠️ Africastalking non configuré — envoi SMS simulé (dev) vers ${maskPhone(phone)}`,
        );
      }
      return false;
    }

    // L'API Africastalking attend un corps en application/x-www-form-urlencoded
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('to', phone); // E.164 obligatoire (ex: +2250708091011)
    body.append('message', text);
    if (senderId) body.append('from', senderId);

    try {
      await firstValueFrom(
        this.httpService.post(AT_BASE_URL, body.toString(), {
          headers: {
            apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          // Timeout : ne jamais bloquer le flux d'auth (sendOtp est rate-limité)
          timeout: 10000,
        }),
      );

      this.logger.log(`📨 SMS Africastalking envoyé vers ${maskPhone(phone)}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `❌ Échec envoi SMS Africastalking: ${error?.response?.data?.message || error?.message || 'inconnu'}`,
      );
      return false;
    }
  }

  /** Message OTP à 6 chiffres (expire en 5 min côté serveur) */
  async sendOtpCode(phone: string, code: string): Promise<boolean> {
    const text = `Bazario : votre code de verification est ${code}. Il expire dans 5 minutes.`;
    return this.sendSms(phone, text);
  }
}
