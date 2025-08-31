import { Controller, Get } from '@nestjs/common';
import axios from 'axios';

@Controller('bridge')
export class BridgeController {
  constructor() {}

  @Get()
  async getConfig() {
    const result = await axios.get(
      'http://100.120.104.106:3000/statistics/config',
    );
    return result.data;
  }

  @Get('/tvl')
  async getTvl() {
    const result = await axios.get(
      'http://100.120.104.106:3000/statistics/tvl',
    );
    return result.data;
  }
}
