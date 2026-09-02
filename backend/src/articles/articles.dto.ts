import { IsString, IsNumber, IsEnum, IsArray, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Categorie, EtatArticle } from '@prisma/client';

export class CreateArticleDto {
  @ApiProperty({ description: 'Titre de l\'annonce', example: 'iPhone 13 Pro 256Go - Gris Sidéral' })
  @IsString()
  titre: string;

  @ApiProperty({ description: 'Description détaillée de l\'article', example: 'iPhone en parfait état, vendu avec chargeur et coque.' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Catégorie', enum: Categorie, example: 'ELECTRONIQUE' })
  @IsEnum(Categorie)
  categorie: Categorie;

  @ApiProperty({ description: 'État de l\'article', enum: EtatArticle, example: 'COMME_NEUF' })
  @IsEnum(EtatArticle)
  etat: EtatArticle;

  @ApiProperty({ description: 'Prix en FCFA', example: 450000 })
  @IsNumber()
  @Min(0)
  prix: number;

  @ApiPropertyOptional({ description: 'Ville', example: 'Abidjan' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ description: 'URLs des photos (déjà uploadées via /upload/image)', example: [] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}

export class UpdateArticleDto {
  @ApiPropertyOptional({ description: 'Titre de l\'annonce' })
  @IsString()
  @IsOptional()
  titre?: string;

  @ApiPropertyOptional({ description: 'Description détaillée' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Catégorie', enum: Categorie })
  @IsEnum(Categorie)
  @IsOptional()
  categorie?: Categorie;

  @ApiPropertyOptional({ description: 'État de l\'article', enum: EtatArticle })
  @IsEnum(EtatArticle)
  @IsOptional()
  etat?: EtatArticle;

  @ApiPropertyOptional({ description: 'Prix en FCFA', example: 450000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  prix?: number;

  @ApiPropertyOptional({ description: 'Ville' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ description: 'URLs des photos' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}

export class SearchArticlesDto {
  @ApiPropertyOptional({ description: 'Recherche textuelle (titre + description)', example: 'iPhone' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Filtrer par catégorie', enum: Categorie })
  @IsEnum(Categorie)
  @IsOptional()
  categorie?: Categorie;

  @ApiPropertyOptional({ description: 'Prix minimum en FCFA', example: 10000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  prixMin?: number;

  @ApiPropertyOptional({ description: 'Prix maximum en FCFA', example: 1000000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  prixMax?: number;

  @ApiPropertyOptional({ description: 'Filtrer par ville', example: 'Abidjan' })
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ description: 'Filtrer par état', enum: EtatArticle })
  @IsEnum(EtatArticle)
  @IsOptional()
  etat?: EtatArticle;
}
