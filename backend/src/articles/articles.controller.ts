import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto, UpdateArticleDto, SearchArticlesDto } from './articles.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller({ path: 'articles', version: '1' })
export class ArticlesController {
  constructor(private articlesService: ArticlesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(userId, dto);
  }

  @Get()
  async findAll(@Query() filters: SearchArticlesDto) {
    return this.articlesService.findAll(filters);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.articlesService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @CurrentUser('sub') userId: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.articlesService.delete(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/sold')
  async markAsSold(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.articlesService.markAsSold(id, userId);
  }
}
