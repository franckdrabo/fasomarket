import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { MobileMoneyPaymentDto, AdminStatsQueryDto } from './payments.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { EscrowDisabledGuard } from '../common/guards/escrow-disabled.guard';

@ApiTags('payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ─── Endpoints authentifiés ───────────────────────────────────────────

  // ─── Escrow DÉSACTIVÉ (achat 100% P2P) ──────────────────────────────
  // L'acheteur paie directement le vendeur par Mobile Money sur le numéro
  // communiqué dans la messagerie : plus de paiement intégré ni de blocage
  // des fonds. Le code du service est conservé mais la route répond 410 Gone.
  @UseGuards(JwtAuthGuard, EscrowDisabledGuard)
  @Post('mobile-money/initiate')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[DÉSACTIVÉ] Initier un paiement Mobile Money', description: '⚠️ Escrow désactivé : l\'achat se fait en direct avec le vendeur via la messagerie. Cette route répond 410 Gone.' })
  @ApiCreatedResponse({ description: 'Paiement initié, en attente de confirmation sur le téléphone' })
  async initiateMobileMoney(
    @CurrentUser('sub') userId: string,
    @Body() dto: MobileMoneyPaymentDto,
  ) {
    return this.paymentsService.initiateMobileMoneyPayment(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:transactionId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Statut d\'un paiement', description: 'Vérifie le statut d\'une transaction de paiement.' })
  @ApiOkResponse({ description: 'Statut de la transaction' })
  async getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentsService.getStatus(transactionId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[Admin] Statistiques paiements', description: 'Statistiques sur les transactions par période (7j, 30j, 90j, 1an).' })
  @ApiQuery({ name: 'periode', required: false, enum: ['7j', '30j', '90j', '1an'] })
  @ApiOkResponse({ description: 'Statistiques des paiements' })
  async getAdminStats(@Query() query: AdminStatsQueryDto) {
    return this.paymentsService.getAdminStats(query.periode);
  }

  // ─── Callback LigdiCash (public, notification de paiement) ────────────
  // LigdiCash notifie via callback_url quand le statut d'une facture change.
  // Le payload contient custom_data avec transaction_id pour identifier la transaction.
  // On re-vérifie toujours le statut côté serveur via l'endpoint confirm.

  @Post('webhook/ligdicash')
  @ApiHeader({ name: 'X-LigdiCash-Signature', required: false, description: 'Signature de verification (si configurée)' })
  @ApiOperation({ summary: 'Callback LigdiCash', description: 'Notification de paiement LigdiCash (Orange Money, Moov Money, Wave, MTN). Authenticité vérifiée via re-vérification côté serveur.' })
  @ApiOkResponse({ description: 'Callback traité' })
  async ligdicashCallback(@Body() payload: any) {
    return this.paymentsService.handleProviderCallback('LIGDICASH', payload);
  }
}
