import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { SwapService } from './swap.service';
import {
  SwapQuoteRequestDto,
  SwapQuoteResponseDto,
  QuickQuoteRequestDto,
  QuickQuoteResponseDto,
} from './dto/swap-quote.dto';

@ApiTags('Swap Aggregator')
@Controller('swap')
@UsePipes(new ValidationPipe({ transform: true }))
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post('quote')
  @ApiOperation({
    summary: 'Get comprehensive swap quote',
    description:
      'Returns all available routes with estimates, sorted by best output',
  })
  @ApiResponse({
    status: 200,
    description: 'Swap quote retrieved successfully',
    type: SwapQuoteResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to calculate swap quote',
  })
  async getSwapQuote(
    @Body() dto: SwapQuoteRequestDto,
  ): Promise<SwapQuoteResponseDto> {
    try {
      return await this.swapService.getSwapQuote(
        dto.fromTokenId,
        dto.toTokenId,
        dto.amount,
        dto.userAddress,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to get swap quote',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('quote/quick')
  @ApiOperation({
    summary: 'Get quick swap quote',
    description: 'Returns only the best route for faster response',
  })
  @ApiResponse({
    status: 200,
    description: 'Quick quote retrieved successfully',
    type: QuickQuoteResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  async getQuickQuote(
    @Query() dto: QuickQuoteRequestDto,
  ): Promise<QuickQuoteResponseDto> {
    try {
      return await this.swapService.getQuickQuote(
        dto.fromTokenId,
        dto.toTokenId,
        dto.amount,
        dto.userAddress,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        {
          message: 'Failed to get quick quote',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('pools')
  @ApiOperation({
    summary: 'Get all available pools',
    description: 'Returns pools from all supported DEXes',
  })
  @ApiResponse({
    status: 200,
    description: 'Pools retrieved successfully',
  })
  async getAllPools(@Query('refresh') refresh?: boolean) {
    try {
      return await this.swapService.getAllPools(refresh || false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        {
          message: 'Failed to get pools',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cache/status')
  @ApiOperation({
    summary: 'Get cache status',
    description: 'Returns information about the pools cache',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache status retrieved successfully',
  })
  getCacheStatus() {
    return this.swapService.getCacheStatus();
  }

  @Post('cache/invalidate')
  @ApiOperation({
    summary: 'Invalidate pools cache',
    description: 'Forces a refresh of pool data on next request',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache invalidated successfully',
  })
  invalidateCache() {
    this.swapService.invalidateCache();
    return { message: 'Cache invalidated successfully' };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the swap service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
  })
  healthCheck() {
    try {
      const cacheStatus = this.swapService.getCacheStatus();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cache: cacheStatus,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        {
          status: 'unhealthy',
          error: errorMessage,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('status')
  async getSwapStatus(@Query('swapId') swapId: string) {
    if (!swapId) {
      throw new Error('Swap ID is required');
    }
    return await this.swapService.getSwapStatus(swapId);
  }
}
