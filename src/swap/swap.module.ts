import { Module } from '@nestjs/common';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { SwapAggregatorService } from './lib/swap-aggregator.service';

@Module({
  controllers: [SwapController],
  providers: [SwapService, SwapAggregatorService],
  exports: [SwapService, SwapAggregatorService],
})
export class SwapModule {}
