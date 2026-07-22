import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'conversations', version: '1' })
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Post()
  async create(@CurrentUser('sub') userId: string, @Body('articleId') articleId: string) {
    return this.conversationsService.create(articleId, userId);
  }

  @Get()
  async findByUser(@CurrentUser('sub') userId: string) {
    return this.conversationsService.findByUser(userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.conversationsService.findById(id, userId);
  }
}
