import { IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MoyenPaiement } from '@prisma/client';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'ID de l\'article à acheter' })
  @IsString()
  articleId: string;

  @ApiProperty({ description: 'ID de la conversation avec le vendeur' })
  @IsString()
  conversationId: string;

  @ApiProperty({ description: 'Montant du paiement en FCFA', example: 15000 })
  @IsNumber()
  @Min(0)
  montant: number;

  @ApiProperty({ description: 'Moyen de paiement', enum: MoyenPaiement, example: 'ORANGE_MONEY' })
  @IsEnum(MoyenPaiement)
  moyenPaiement: MoyenPaiement;
}

export class ConfirmReceptionDto {
  @ApiProperty({ description: 'ID de la transaction à confirmer' })
  @IsString()
  transactionId: string;
}

export class OpenDisputeDto {
  @ApiProperty({ description: 'ID de la transaction en litige' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Motif détaillé du litige', example: 'Article non conforme à la description, couleur différente.' })
  @IsString()
  motif: string;
}
