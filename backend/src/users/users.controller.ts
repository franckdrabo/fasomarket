import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile/:id')
  async getProfile(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/articles')
  async getUserArticles(@Param('id') id: string, @Query('statut') statut?: string) {
    return this.usersService.getArticlesByUser(id, statut);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/avis')
  async getUserAvis(@Param('id') id: string) {
    return this.usersService.getAvisRecus(id);
  }
}
