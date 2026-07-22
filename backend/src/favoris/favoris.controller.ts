import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FavorisService } from './favoris.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'favoris', version: '1' })
export class FavorisController {
  constructor(private favorisService: FavorisService) {}

  @Post('toggle/:articleId')
  async toggle(
    @CurrentUser('sub') userId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.favorisService.toggle(userId, articleId);
  }

  @Get()
  async findByUser(@CurrentUser('sub') userId: string) {
    return this.favorisService.findByUser(userId);
  }

  @Get('check/:articleId')
  async check(
    @CurrentUser('sub') userId: string,
    @Param('articleId') articleId: string,
  ) {
    const favori = await this.favorisService.isFavori(userId, articleId);
    return { favori };
  }
}
