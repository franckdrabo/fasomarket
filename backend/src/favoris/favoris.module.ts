import { Module } from '@nestjs/common';
import { FavorisController } from './favoris.controller';
import { FavorisService } from './favoris.service';

@Module({
  controllers: [FavorisController],
  providers: [FavorisService],
  exports: [FavorisService],
})
export class FavorisModule {}
