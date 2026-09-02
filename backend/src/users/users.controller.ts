import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Profil complet', description: 'Retourne le profil complet d\'un utilisateur (authentifié requis).' })
  @ApiOkResponse({ description: 'Profil utilisateur' })
  async getProfile(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Profil public', description: 'Retourne les informations publiques d\'un utilisateur (sans auth).' })
  @ApiOkResponse({ description: 'Profil public' })
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/articles')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Articles d\'un utilisateur', description: 'Liste les articles d\'un utilisateur, filtrés par statut.' })
  @ApiQuery({ name: 'statut', required: false })
  @ApiOkResponse({ description: 'Liste des articles' })
  async getUserArticles(@Param('id') id: string, @Query('statut') statut?: string) {
    return this.usersService.getArticlesByUser(id, statut);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/avis')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Avis reçus', description: 'Liste les avis reçus par un utilisateur.' })
  @ApiOkResponse({ description: 'Liste des avis' })
  async getUserAvis(@Param('id') id: string) {
    return this.usersService.getAvisRecus(id);
  }
}
