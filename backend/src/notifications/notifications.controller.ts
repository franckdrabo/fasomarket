import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller({ path: 'notifications', version: '1' })
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── Gestion des tokens FCM ────────────────────────────────────────────

  @Post('register-token')
  async registerToken(
    @CurrentUser('sub') userId: string,
    @Body('token') token: string,
  ) {
    await this.prisma.addFcmToken(userId, token);
    return { message: 'Token enregistré' };
  }

  @Delete('unregister-token')
  async unregisterToken(
    @CurrentUser('sub') userId: string,
    @Body('token') token: string,
  ) {
    await this.prisma.removeFcmToken(userId, token);
    return { message: 'Token désenregistré' };
  }

  // ─── Historique des notifications ──────────────────────────────────────

  @Get('history')
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getHistory(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Post('mark-read/:id')
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(id, userId);
    return { message: 'Notification marquée comme lue' };
  }

  @Post('mark-all-read')
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'Toutes les notifications marquées comme lues' };
  }
}
