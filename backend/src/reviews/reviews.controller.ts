import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './reviews.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('reviews')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Donner un avis', description: 'Laisse un avis (note/commentaire) sur une transaction terminée.' })
  @ApiCreatedResponse({ description: 'Avis créé' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  @Get('user/:userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Avis d\'un utilisateur', description: 'Retourne tous les avis reçus par un utilisateur.' })
  @ApiOkResponse({ description: 'Liste des avis' })
  async findByUser(@Param('userId') userId: string) {
    return this.reviewsService.findByUser(userId);
  }
}
