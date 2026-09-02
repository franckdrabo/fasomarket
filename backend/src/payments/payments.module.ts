import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CinetPayService, MobileMoneyFactory } from './mobile-money.service';
import { FedaPayService } from './fedapay.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HttpModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    CinetPayService,
    FedaPayService,
    MobileMoneyFactory,
  ],
  exports: [PaymentsService, MobileMoneyFactory],
})
export class PaymentsModule {}
