import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── Gestion des tokens FCM ────────────────────────────────────────────

  @Post('register-token')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Enregistrer un token FCM', description: 'Enregistre un token de notification push pour l\'utilisateur connecté.' })
  @ApiCreatedResponse({ description: 'Token enregistré' })
  async registerToken(
    @CurrentUser('sub') userId: string,
    @Body('token') token: string,
  ) {
    await this.prisma.addFcmToken(userId, token);
    return { message: 'Token enregistré' };
  }

  @Delete('unregister-token')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Désenregistrer un token FCM', description: 'Supprime un token de notification push (déconnexion). Le token est passé en query param car DELETE avec body nest pas toujours supporté.' })
  @ApiOkResponse({ description: 'Token désenregistré' })
  async unregisterToken(
    @CurrentUser('sub') userId: string,
    @Query('token') token: string,
  ) {
    await this.prisma.removeFcmToken(userId, token);
    return { message: 'Token désenregistré' };
  }

  // ─── Historique des notifications ──────────────────────────────────────

  @Get('history')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Historique des notifications', description: 'Retourne l\'historique paginé des notifications de l\'utilisateur.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Liste paginée des notifications' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Nombre de notifications non lues', description: 'Retourne le nombre de notifications non lues pour l\'utilisateur.' })
  @ApiOkResponse({ description: 'Compteur de notifications', schema: { example: { count: 5 } } })
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Post('mark-read/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Marquer une notification comme lue', description: 'Marque une notification spécifique comme lue.' })
  @ApiOkResponse({ description: 'Notification marquée comme lue' })
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(id, userId);
    return { message: 'Notification marquée comme lue' };
  }

  @Post('mark-all-read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tout marquer comme lu', description: 'Marque toutes les notifications de l\'utilisateur comme lues.' })
  @ApiOkResponse({ description: 'Toutes les notifications marquées comme lues' })
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'Toutes les notifications marquées comme lues' };
  }
}
