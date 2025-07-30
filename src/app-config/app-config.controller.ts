import { Controller, Get } from '@nestjs/common';
import { AGGREGATOR_ID } from './constants';

@Controller('/app-config')
export class AppConfigController {
  constructor() {}

  @Get()
  getConfig() {
    return {
      aggregatorProcess: AGGREGATOR_ID,
    };
  }
}
