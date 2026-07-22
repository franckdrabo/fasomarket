import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import {
  OrangeMoneyService,
  MoovMoneyService,
  WaveMoneyService,
  MobileMoneyFactory,
} from './mobile-money.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HttpModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    OrangeMoneyService,
    MoovMoneyService,
    WaveMoneyService,
    MobileMoneyFactory,
  ],
  exports: [PaymentsService, MobileMoneyFactory],
})
export class PaymentsModule {}
