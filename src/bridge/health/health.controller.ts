import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('bridge/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async checkHealth() {
    const apiUrl = 'http://100.120.104.106:3000';

    if (!apiUrl) {
      throw new HttpException(
        'API_URL environment variable is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return {
        status: 'healthy',
        apiStatus: response.status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'API is not available';

      throw new HttpException(
        {
          status: 'unhealthy',
          error: errorMessage,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('dryruns')
  getDryrunHealthStatus() {
    return this.healthService.getHealthStatus();
  }
}
