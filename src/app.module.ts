import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SwapAggregatorService } from './swap-aggregator.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, SwapAggregatorService],
})
export class AppModule {}
