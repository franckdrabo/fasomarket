import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { LigdiCashService } from './ligdicash.service';
import { MobileMoneyFactory } from './mobile-money.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HttpModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    LigdiCashService,
    MobileMoneyFactory,
  ],
  exports: [PaymentsService, MobileMoneyFactory],
})
export class PaymentsModule {}
