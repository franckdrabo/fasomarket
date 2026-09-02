import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MoyenPaiement } from '@prisma/client';

export class MobileMoneyPaymentDto {
  @ApiProperty({ description: 'ID de la transaction' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Numéro de téléphone pour la demande de paiement', example: '+2250102030405' })
  @IsString()
  telephone: string;

  @ApiProperty({ description: 'Opérateur Mobile Money', enum: MoyenPaiement, example: 'ORANGE_MONEY' })
  @IsEnum(MoyenPaiement)
  moyenPaiement: MoyenPaiement;
}

export class CheckPaymentStatusDto {
  @ApiProperty({ description: 'ID de la transaction' })
  @IsString()
  transactionId: string;
}

export class AdminStatsQueryDto {
  @ApiPropertyOptional({ description: 'Période d\'analyse', enum: ['7j', '30j', '90j', '1an'], default: '30j' })
  @IsOptional()
  @IsString()
  periode?: '7j' | '30j' | '90j' | '1an';
}
