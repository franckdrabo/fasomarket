import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiQuery } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './conversations.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('conversations')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'conversations', version: '1' })
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Créer une conversation', description: 'Crée une nouvelle conversation entre acheteur et vendeur pour un article.' })
  @ApiCreatedResponse({ description: 'Conversation créée (ou existante retournée)' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto.articleId, userId);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lister mes conversations', description: 'Retourne toutes les conversations de l\'utilisateur connecté.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Liste des conversations' })
  async findByUser(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.findByUser(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Détail d\'une conversation', description: 'Retourne une conversation avec tous ses messages (participants uniquement).' })
  @ApiOkResponse({ description: 'Conversation avec messages' })
  async findById(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.conversationsService.findById(id, userId);
  }
}
