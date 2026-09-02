import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from '../notifications/notifications.service';

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ORIGIN || 'https://api.fasomarket.com').split(',')
      : '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, string[]>(); // userId -> socketIds[]

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string);
      const userId = payload.sub;

      // Associer le socket à l'utilisateur
      const sockets = this.userSockets.get(userId) || [];
      sockets.push(client.id);
      this.userSockets.set(userId, sockets);

      // Rejoindre les rooms des conversations de l'utilisateur
      const conversations = await this.prisma.conversation.findMany({
        where: {
          OR: [{ acheteurId: userId }, { vendeurId: userId }],
        },
        select: { id: true },
      });

      conversations.forEach((conv) => {
        client.join(`conv:${conv.id}`);
      });

      client.data.userId = userId;
      this.logger.log(`User ${userId} connected (socket: ${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId) || [];
      const updated = sockets.filter((s) => s !== client.id);
      if (updated.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, updated);
      }
      this.logger.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; contenu: string; offrePrix?: number },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // Vérifier que l'utilisateur participe à cette conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });
    if (!conversation || (conversation.acheteurId !== userId && conversation.vendeurId !== userId)) {
      return;
    }

    // Créer le message
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        expediteurId: userId,
        contenu: data.contenu,
        type: data.offrePrix ? 'OFFRE' : 'TEXTE',
        offrePrix: data.offrePrix,
      },
      include: {
        expediteur: { select: { id: true, nom: true, avatar: true } },
      },
    });

    // Mettre à jour le timestamp de la conversation
    await this.prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    // Diffuser à tous les participants
    this.server.to(`conv:${data.conversationId}`).emit('newMessage', message);

    // Notifications push pour le destinataire (s'il n'est pas en ligne via socket)
    const destinataireId =
      conversation.acheteurId === userId
        ? conversation.vendeurId
        : conversation.acheteurId;

    const destinataireSockets = this.userSockets.get(destinataireId);
    const estEnLigne = destinataireSockets && destinataireSockets.length > 0;

    if (!estEnLigne) {
      const article = await this.prisma.article.findUnique({
        where: { id: conversation.articleId },
        select: { titre: true },
      });

      const titreArticle = article?.titre ?? 'Article';
      const titreCourt = titreArticle.length > 50
        ? titreArticle.substring(0, 50) + '...'
        : titreArticle;

      await this.notificationsService.sendToUser(destinataireId, {
        title: message.expediteur.nom,
        body:
          message.type === 'OFFRE'
            ? `💰 Nouvelle offre de ${data.offrePrix?.toLocaleString()} FCFA sur "${titreCourt}"`
            : `💬 ${data.contenu.substring(0, 100)}${data.contenu.length > 100 ? '...' : ''}`,
        data: {
          type: 'new_message',
          conversationId: data.conversationId,
          messageId: message.id,
        },
      });
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (conversation && (conversation.acheteurId === userId || conversation.vendeurId === userId)) {
      client.join(`conv:${data.conversationId}`);
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    client.to(`conv:${data.conversationId}`).emit('userTyping', {
      userId,
      conversationId: data.conversationId,
      isTyping: data.isTyping,
    });
  }
}
