import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  transactionId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  note: number;

  @IsString()
  @IsOptional()
  commentaire?: string;
}
