import { Controller, Get } from '@nestjs/common';

@Controller('/app-config')
export class AppConfigController {
  constructor() {}

  @Get()
  getConfig() {
    return {
      aggregatorProcess: 'cEZfKpbSfHYrmaOFGzn7CvHgWdHueZEn9DHq-aLpCms',
    };
  }
}
