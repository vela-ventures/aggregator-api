import { Module } from '@nestjs/common';
import { BridgeController } from './bridge.controller';
import { HealthModule } from './health/health.module';
import { StatusModule } from './status/status.module';

@Module({
  imports: [HealthModule, StatusModule],
  controllers: [BridgeController],
})
export class BridgeModule {}
