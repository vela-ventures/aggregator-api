import { Module } from '@nestjs/common';
import { SwapService } from './swap.service';
import { SwapController } from './swap.controller';
import { RoutesModule } from '../routes/routes.module';
import { EstimatesModule } from '../estimates/estimates.module';
import { PoolsModule } from '../pools/pools.module';

@Module({
  imports: [RoutesModule, EstimatesModule, PoolsModule],
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
