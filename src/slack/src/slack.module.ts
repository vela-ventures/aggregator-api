import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
