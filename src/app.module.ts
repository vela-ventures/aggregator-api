import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PoolsModule } from './pools/pools.module';
import { RoutesModule } from './routes/routes.module';
import { EstimatesModule } from './estimates/estimates.module';
import { SwapModule } from './swap/swap.module';
import { OrdersModule } from './orders/orders.module';
import { MessagesModule } from './messages/messages.module';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './app-config';
import { BridgeModule } from './bridge';

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
    MessagesModule,
    AppConfigModule,
    BridgeModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
