import { IsString, IsNumber, IsEnum, Min, Max, IsOptional } from 'class-validator';
import { MoyenPaiement } from '@prisma/client';

export class MobileMoneyPaymentDto {
  @IsString()
  transactionId: string;

  @IsString()
  telephone: string;

  @IsEnum(MoyenPaiement)
  moyenPaiement: MoyenPaiement;
}

export class CheckPaymentStatusDto {
  @IsString()
  transactionId: string;
}

export class AdminStatsQueryDto {
  @IsOptional()
  @IsString()
  periode?: '7j' | '30j' | '90j' | '1an';
}
