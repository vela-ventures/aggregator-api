import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SwapAggregatorService } from './swap/lib/swap-aggregator.service';
import { RoutesModule } from './routes/routes.module';
import { SwapModule } from './swap/swap.module';
import { EstimatesModule } from './estimates/estimates.module';
import { PoolsModule } from './pools/pools.module';

@Module({
  imports: [EstimatesModule, PoolsModule, RoutesModule, SwapModule],
  controllers: [AppController],
  providers: [SwapAggregatorService],
})
export class AppModule {}
