import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { CreateArticleDto, UpdateArticleDto, SearchArticlesDto } from './articles.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('articles')
@Controller({ path: 'articles', version: '1' })
export class ArticlesController {
  constructor(private articlesService: ArticlesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Créer une annonce', description: 'Publie une nouvelle annonce avec photos, description et prix.' })
  @ApiCreatedResponse({ description: 'Annonce créée avec succès' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Rechercher des articles', description: 'Liste les articles avec filtres (catégorie, prix, recherche textuelle, ville, état).' })
  @ApiOkResponse({ description: 'Liste des articles filtrés' })
  async findAll(@Query() filters: SearchArticlesDto) {
    return this.articlesService.findAll(filters);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mes annonces', description: 'Liste toutes les annonces de l\'utilisateur connecté.' })
  @ApiOkResponse({ description: 'Liste de mes annonces' })
  async findMine(@CurrentUser('sub') userId: string) {
    return this.articlesService.findByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un article', description: 'Retourne les informations complètes d\'un article par son ID.' })
  @ApiOkResponse({ description: 'Détail de l\'article' })
  async findById(@Param('id') id: string) {
    return this.articlesService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Modifier une annonce', description: 'Met à jour les informations d\'un article (propriétaire uniquement).' })
  @ApiOkResponse({ description: 'Annonce modifiée' })
  async update(@Param('id') id: string, @CurrentUser('sub') userId: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Supprimer une annonce', description: 'Supprime définitivement une annonce (propriétaire uniquement).' })
  @ApiOkResponse({ description: 'Annonce supprimée' })
  async delete(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.articlesService.delete(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/sold')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Marquer comme vendu', description: 'Marque un article comme vendu (propriétaire uniquement).' })
  @ApiOkResponse({ description: 'Article marqué comme vendu' })
  async markAsSold(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.articlesService.markAsSold(id, userId);
  }
}
