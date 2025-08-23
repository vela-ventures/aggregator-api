import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Controller('bridge/status')
export class StatusController {
  @Get(':txId')
  async getBridgeEventStatus(@Param('txId') txId: string) {
    const apiUrl = 'http://100.120.104.106:3000';

    if (!apiUrl) {
      throw new HttpException(
        'API_URL environment variable is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await fetch(`${apiUrl}/status/${txId}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new HttpException(
            `Bridge event with transaction ID ${txId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        throw new HttpException(
          `API responded with status ${response.status}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'API is not available';

      throw new HttpException(
        {
          error: errorMessage,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get(':chain/:txId')
  async getBridgeEventStatusNetwork(@Param('chain') chain: string, @Param('txId') txId: string) {
    const apiUrl = 'http://100.120.104.106:3000';

    if (!apiUrl) {
      throw new HttpException(
        'API_URL environment variable is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await fetch(`${apiUrl}/status/${chain}/${txId}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new HttpException(
            `Bridge event with transaction ID ${txId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        throw new HttpException(
          `API responded with status ${response.status}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'API is not available';

      throw new HttpException(
        {
          error: errorMessage,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
