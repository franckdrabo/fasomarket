import { IsString, IsNumber, IsEnum, IsArray, IsOptional, Min, Max } from 'class-validator';
import { Categorie, EtatArticle } from '@prisma/client';

export class CreateArticleDto {
  @IsString()
  titre: string;

  @IsString()
  description: string;

  @IsEnum(Categorie)
  categorie: Categorie;

  @IsEnum(EtatArticle)
  etat: EtatArticle;

  @IsNumber()
  @Min(0)
  prix: number;

  @IsString()
  @IsOptional()
  ville?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}

export class UpdateArticleDto {
  @IsString()
  @IsOptional()
  titre?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Categorie)
  @IsOptional()
  categorie?: Categorie;

  @IsEnum(EtatArticle)
  @IsOptional()
  etat?: EtatArticle;

  @IsNumber()
  @Min(0)
  @IsOptional()
  prix?: number;

  @IsString()
  @IsOptional()
  ville?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}

export class SearchArticlesDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsEnum(Categorie)
  @IsOptional()
  categorie?: Categorie;

  @IsNumber()
  @IsOptional()
  @Min(0)
  prixMin?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  prixMax?: number;

  @IsString()
  @IsOptional()
  ville?: string;

  @IsEnum(EtatArticle)
  @IsOptional()
  etat?: EtatArticle;
}
