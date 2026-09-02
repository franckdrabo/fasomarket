import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EscrowSchedulerService } from './escrow-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  providers: [EscrowSchedulerService],
  exports: [EscrowSchedulerService],
})
export class TasksModule {}
