import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MobileMoneyPaymentDto, AdminStatsQueryDto } from './payments.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ─── Endpoints authentifiés ───────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('mobile-money/initiate')
  async initiateMobileMoney(
    @CurrentUser('sub') userId: string,
    @Body() dto: MobileMoneyPaymentDto,
  ) {
    return this.paymentsService.initiateMobileMoneyPayment(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:transactionId')
  async getStatus(@Param('transactionId') transactionId: string) {
    return this.paymentsService.getStatus(transactionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/stats')
  async getAdminStats(@Query() query: AdminStatsQueryDto) {
    return this.paymentsService.getAdminStats(query.periode);
  }

  // ─── Webhooks providers (public, signature vérifiée) ──────────────────

  @Post('webhook/orange-money')
  async orangeMoneyCallback(@Body() payload: any) {
    return this.paymentsService.handleProviderCallback('ORANGE_MONEY', payload);
  }

  @Post('webhook/moov-money')
  async moovMoneyCallback(@Body() payload: any) {
    return this.paymentsService.handleProviderCallback('MOOV_MONEY', payload);
  }

  @Post('webhook/wave')
  async waveCallback(@Body() payload: any) {
    return this.paymentsService.handleProviderCallback('WAVE', payload);
  }
}
