import { Controller, Get, Query } from '@nestjs/common';
import { PoolsService } from './pools.service';

@Controller('pools')
export class PoolsController {
  constructor(private readonly poolsService: PoolsService) {}

  @Get()
  async getPools(@Query('refresh') refresh?: string) {
    const forceRefresh = refresh === 'true';
    return await this.poolsService.getAllPools(forceRefresh);
  }

  @Get('status')
  getCacheStatus() {
    return this.poolsService.getCacheStatus();
  }
}
