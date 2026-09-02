import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Service d'envoi d'emails transactionnels (codes OTP) via SMTP.
 *
 * Configuration (env) :
 *   - SMTP_HOST     : serveur SMTP (défaut: smtp.gmail.com)
 *   - SMTP_PORT     : port (défaut: 465)
 *   - SMTP_USER     : adresse email d'envoi
 *   - SMTP_PASS     : mot de passe ou app password
 *   - SMTP_FROM     : nom d'affichage de l'expéditeur (défaut: "Bazario")
 *
 * En dev sans SMTP configuré : log le code dans la console (pas d'envoi réel).
 */

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      this.logger.warn(
        '⚠️ SMTP non configuré (SMTP_USER / SMTP_PASS manquants) — emails simulés en dev',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    this.logger.log(`📧 EmailService initialisé → ${host}:${port}`);
  }

  /**
   * Envoie un email.
   * @returns true si l'email a été envoyé avec succès.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) {
      // Mode simulation (dev)
      this.logger.log(
        `📧 [SIMULÉ] Email à ${to} — Sujet: ${subject}`,
      );
      return false;
    }

    const from = process.env.SMTP_FROM || 'Bazario';

    try {
      await this.transporter.sendMail({
        from: `"${from}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`📧 Email envoyé à ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `❌ Échec envoi email: ${error?.message || 'inconnu'}`,
      );
      return false;
    }
  }

  /** Envoie un code OTP par email (HTML). */
  async sendOtpCode(email: string, code: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #FF6B35; font-size: 28px; margin: 0;">Bazario</h1>
          <p style="color: #7F8C8D; font-size: 14px; margin-top: 4px;">Le marché de confiance</p>
        </div>

        <div style="background: #FFF8F0; border-radius: 16px; padding: 32px; text-align: center; border: 1px solid #E8D5C4;">
          <p style="color: #2C3E50; font-size: 16px; margin: 0 0 16px;">
            Voici votre code de vérification :
          </p>
          <div style="font-size: 40px; font-weight: 800; color: #FF6B35; letter-spacing: 8px; margin: 24px 0;">
            ${code}
          </div>
          <p style="color: #7F8C8D; font-size: 13px; margin: 0;">
            Ce code expire dans <strong>5 minutes</strong>.
          </p>
        </div>

        <p style="color: #BDC3C7; font-size: 12px; text-align: center; margin-top: 24px;">
          Si vous n'avez pas demandé ce code, ignorez cet email.
        </p>
      </div>
    `;

    return this.sendEmail(
      email,
      `Bazario — Votre code de vérification : ${code}`,
      html,
    );
  }
}
