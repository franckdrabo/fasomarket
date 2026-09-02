import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { FavorisService } from './favoris.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('favoris')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'favoris', version: '1' })
export class FavorisController {
  constructor(private favorisService: FavorisService) {}

  @Post('toggle/:articleId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ajouter/Retirer des favoris', description: 'Ajoute ou retire un article des favoris (toggle).' })
  @ApiCreatedResponse({ description: 'Favori mis à jour', schema: { example: { favori: true, message: 'Article ajouté aux favoris' } } })
  async toggle(
    @CurrentUser('sub') userId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.favorisService.toggle(userId, articleId);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mes favoris', description: 'Liste tous les articles favoris de l\'utilisateur connecté.' })
  @ApiOkResponse({ description: 'Liste des favoris' })
  async findByUser(@CurrentUser('sub') userId: string) {
    return this.favorisService.findByUser(userId);
  }

  @Get('check/:articleId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Vérifier un favori', description: 'Vérifie si un article est dans les favoris de l\'utilisateur.' })
  @ApiOkResponse({ description: 'Statut du favori', schema: { example: { favori: true } } })
  async check(
    @CurrentUser('sub') userId: string,
    @Param('articleId') articleId: string,
  ) {
    const favori = await this.favorisService.isFavori(userId, articleId);
    return { favori };
  }
}
