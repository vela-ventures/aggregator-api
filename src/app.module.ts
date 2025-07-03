import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SwapAggregatorService } from './swap/lib/swap-aggregator.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [SwapAggregatorService],
})
export class AppModule {}
