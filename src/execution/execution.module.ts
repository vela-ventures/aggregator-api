import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { OrdersModule } from '../orders/orders.module';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [OrdersModule, SharedModule],
  controllers: [ExecutionController],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
