import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'ID de la transaction terminée à évaluer' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Note de 1 à 5', example: 5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  note: number;

  @ApiPropertyOptional({ description: 'Commentaire optionnel', example: 'Excellent vendeur, envoi rapide et article conforme.' })
  @IsString()
  @IsOptional()
  commentaire?: string;
}
