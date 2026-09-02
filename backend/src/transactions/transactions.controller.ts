import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiQuery } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { InitiatePaymentDto, ConfirmReceptionDto, OpenDisputeDto } from './transactions.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { EscrowDisabledGuard } from '../common/guards/escrow-disabled.guard';

@ApiTags('transactions')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  // ─── Escrow DÉSACTIVÉ (achat 100% P2P) ──────────────────────────────
  // Les routes ci-dessous créaient ou traitaient une transaction en escrow
  // (blocage des fonds, litiges). Elles répondent désormais 410 Gone :
  // l'acheteur paie directement le vendeur via la messagerie.
  // Les routes de LECTURE (liste, détail) et d'admin restent actives.

  @UseGuards(JwtAuthGuard, EscrowDisabledGuard)
  @Post('initiate')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[DÉSACTIVÉ] Initier un paiement', description: '⚠️ Escrow désactivé : l\'achat se fait en direct avec le vendeur via la messagerie. Cette route répond 410 Gone.' })
  @ApiCreatedResponse({ description: 'Transaction créée en escrow' })
  async initiatePayment(@CurrentUser('sub') userId: string, @Body() dto: InitiatePaymentDto) {
    return this.transactionsService.initiatePayment(userId, dto);
  }

  @UseGuards(JwtAuthGuard, EscrowDisabledGuard)
  @Post('confirm-payment/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[DÉSACTIVÉ] Confirmer un paiement', description: '⚠️ Escrow désactivé. Cette route répond 410 Gone.' })
  @ApiOkResponse({ description: 'Paiement confirmé, fonds bloqués' })
  async confirmPayment(@Param('id') id: string, @Body('reference') reference: string) {
    return this.transactionsService.confirmPayment(id, reference);
  }

  @UseGuards(JwtAuthGuard, EscrowDisabledGuard)
  @Post('confirm-reception')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[DÉSACTIVÉ] Confirmer la réception', description: '⚠️ Escrow désactivé. Cette route répond 410 Gone.' })
  @ApiOkResponse({ description: 'Réception confirmée, fonds libérés' })
  async confirmReception(@CurrentUser('sub') userId: string, @Body() dto: ConfirmReceptionDto) {
    return this.transactionsService.confirmReception(userId, dto);
  }

  @UseGuards(JwtAuthGuard, EscrowDisabledGuard)
  @Post('dispute')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[DÉSACTIVÉ] Ouvrir un litige', description: '⚠️ Escrow désactivé. Cette route répond 410 Gone.' })
  @ApiCreatedResponse({ description: 'Litige ouvert, équipe FasoMarket notifiée' })
  async openDispute(@CurrentUser('sub') userId: string, @Body() dto: OpenDisputeDto) {
    return this.transactionsService.openDispute(userId, dto);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mes transactions', description: 'Liste les transactions de l\'utilisateur connecté (achats et ventes).' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Liste paginée des transactions' })
  async findByUser(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findByUser(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Détail d\'une transaction', description: 'Retourne les informations complètes d\'une transaction par son ID.' })
  @ApiOkResponse({ description: 'Détail de la transaction' })
  async findById(@Param('id') id: string) {
    return this.transactionsService.findById(id);
  }

  // ─── Endpoints Admin ──────────────────────────────────────────────────

  @Get('admin/disputes')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[Admin] Lister les litiges', description: 'Liste toutes les transactions en statut LITIGE (réservé admin).' })
  @ApiOkResponse({ description: 'Liste des litiges' })
  async getDisputes() {
    return this.transactionsService.getDisputes();
  }

  @Post('admin/resolve-dispute/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[Admin] Résoudre un litige', description: 'Résout un litige en libérant les fonds (LIBERE) ou en remboursant (REMBOURSE).' })
  @ApiOkResponse({ description: 'Litige résolu' })
  async resolveDispute(
    @Param('id') id: string,
    @Body('action') action: 'LIBERE' | 'REMBOURSE',
  ) {
    return this.transactionsService.resolveDispute(id, action);
  }
}
