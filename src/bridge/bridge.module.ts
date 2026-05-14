import { Module } from '@nestjs/common';
import { BridgeController } from './bridge.controller';
import { HealthModule } from './health/health.module';
import { StatusModule } from './status/status.module';
import { SolanaModule } from './solana/solana.module';

@Module({
  imports: [HealthModule, StatusModule, SolanaModule],
  controllers: [BridgeController],
})
export class BridgeModule {}
