import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({
    summary: 'API Health Check',
    description: 'Returns basic API health status',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy and running',
  })
  getHealth() {
    return {
      status: 'healthy',
      message: 'Swap Aggregator API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
