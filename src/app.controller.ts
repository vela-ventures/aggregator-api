import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SwapAggregatorService } from './swap-aggregator.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly swapService: SwapAggregatorService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('pools')
  async getPools() {
    console.log('here');
    return await this.swapService.getAllPools();
  }

  @Get('find-roots')
  async getRoots() {
    console.log('here');
    return await this.swapService.findAllRoutes(
      {
        name: 'AO',
        symbol: 'AO',
        denomination: 12,
        processId: '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc',
      },
      {
        name: 'Wrapped AR',
        symbol: 'wAR',
        denomination: 12,
        processId: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
      },
    );
  }
}
