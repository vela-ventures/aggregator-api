import { Controller, Get } from '@nestjs/common';
import { AGGREGATOR_ID, AVAILABLE_TOKENS } from './constants';

@Controller('/app-config')
export class AppConfigController {
  constructor() {}

  @Get()
  getConfig() {
    return {
      aggregatorProcess: AGGREGATOR_ID,
    };
  }

  @Get('/tokens')
  getTokens() {
    return AVAILABLE_TOKENS;
  }
}
