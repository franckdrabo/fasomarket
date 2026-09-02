import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'ID de l\'article pour lequel créer la conversation' })
  @IsString()
  articleId: string;
}
