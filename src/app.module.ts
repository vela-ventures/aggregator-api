import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PoolsModule } from './pools/pools.module';
import { RoutesModule } from './routes/routes.module';
import { EstimatesModule } from './estimates/estimates.module';
import { SwapModule } from './swap/swap.module';

@Module({
  imports: [PoolsModule, RoutesModule, EstimatesModule, SwapModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
