import { Injectable, CanActivate, ExecutionContext, GoneException, Logger } from '@nestjs/common';

/**
 * EscrowDisabledGuard
 *
 * Désactive les endpoints du paiement sécurisé (escrow) côté serveur.
 *
 * Depuis la décision produit « achat 100% P2P », les transactions d'articles ne
 * passent plus par l'escrow Bazario : l'acheteur paie directement le vendeur
 * par Mobile Money sur le numéro communiqué dans la messagerie.
 *
 * Le code des services (PaymentsService, TransactionsService) est conservé
 * pour un éventuel retour en arrière, mais les routes qui créent ou traitent
 * une transaction escrow répondent 410 Gone.
 *
 * Les routes de LECTURE (statut, historique) et le webhook CinetPay restent
 * actifs : le webhook est nécessaire à l'activation vendeur (1 000 FCFA).
 */
@Injectable()
export class EscrowDisabledGuard implements CanActivate {
  private readonly logger = new Logger(EscrowDisabledGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const route = `${request.method} ${request.originalUrl || request.url}`;

    this.logger.warn(`🚫 ${route} — escrow désactivé (achat P2P direct)`);

    throw new GoneException(
      'Le paiement sécurisé (escrow) a été désactivé. ' +
        'L\'achat se fait en direct avec le vendeur : contactez-le via la messagerie, ' +
        'convenez du prix et payez-le par Mobile Money sur le numéro qu\'il vous communique.',
    );
  }
}
