import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SlackModule } from '../../slack/src';

@Module({
  imports: [ScheduleModule, SlackModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
