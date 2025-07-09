import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PoolsModule } from './pools/pools.module';
import { RoutesModule } from './routes/routes.module';
import { EstimatesModule } from './estimates/estimates.module';
import { SwapModule } from './swap/swap.module';
import { OrdersModule } from './orders/orders.module';
import { ExecutionModule } from './execution/execution.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PoolsModule,
    RoutesModule,
    EstimatesModule,
    SwapModule,
    OrdersModule,
    ExecutionModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
