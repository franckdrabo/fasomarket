import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async findByConversation(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
      include: {
        expediteur: { select: { id: true, nom: true, avatar: true } },
      },
    });
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        expediteurId: { not: userId },
        lu: false,
      },
      data: { lu: true },
    });

    return { message: 'Messages marqués comme lus' };
  }

  async getUnreadCount(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ acheteurId: userId }, { vendeurId: userId }],
      },
      select: { id: true },
    });

    const conversationIds = conversations.map((c) => c.id);

    const count = await this.prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        expediteurId: { not: userId },
        lu: false,
      },
    });

    return { unreadCount: count };
  }
}
