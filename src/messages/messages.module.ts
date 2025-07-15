import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { OrdersModule } from '../orders/orders.module';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [OrdersModule, SharedModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
