import { IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { MoyenPaiement } from '@prisma/client';

export class InitiatePaymentDto {
  @IsString()
  articleId: string;

  @IsString()
  conversationId: string;

  @IsNumber()
  @Min(0)
  montant: number;

  @IsEnum(MoyenPaiement)
  moyenPaiement: MoyenPaiement;
}

export class ConfirmReceptionDto {
  @IsString()
  transactionId: string;
}

export class OpenDisputeDto {
  @IsString()
  transactionId: string;

  @IsString()
  motif: string;
}
