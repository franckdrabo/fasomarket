import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { InitiatePaymentDto, ConfirmReceptionDto, OpenDisputeDto } from './transactions.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post('initiate')
  async initiatePayment(@CurrentUser('sub') userId: string, @Body() dto: InitiatePaymentDto) {
    return this.transactionsService.initiatePayment(userId, dto);
  }

  @Post('confirm-payment/:id')
  async confirmPayment(@Param('id') id: string, @Body('reference') reference: string) {
    return this.transactionsService.confirmPayment(id, reference);
  }

  @Post('confirm-reception')
  async confirmReception(@CurrentUser('sub') userId: string, @Body() dto: ConfirmReceptionDto) {
    return this.transactionsService.confirmReception(userId, dto);
  }

  @Post('dispute')
  async openDispute(@CurrentUser('sub') userId: string, @Body() dto: OpenDisputeDto) {
    return this.transactionsService.openDispute(userId, dto);
  }

  @Get()
  async findByUser(@CurrentUser('sub') userId: string) {
    return this.transactionsService.findByUser(userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.transactionsService.findById(id);
  }
}
