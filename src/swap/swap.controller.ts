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
  TokenDto,
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
        dto.fromToken,
        dto.toToken,
        dto.amount,
        dto.userAddress,
      );
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get swap quote',
          error: error.message,
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
      // You'll need to implement a token lookup service
      // For now, this is a simplified version
      const fromToken: TokenDto = {
        processId: dto.fromTokenId,
        denomination: 12, // Default - should come from token service
      };

      const toToken: TokenDto = {
        processId: dto.toTokenId,
        denomination: 12, // Default - should come from token service
      };

      return await this.swapService.getQuickQuote(
        fromToken,
        toToken,
        dto.amount,
        dto.userAddress,
      );
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get quick quote',
          error: error.message,
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
      throw new HttpException(
        {
          message: 'Failed to get pools',
          error: error.message,
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
      throw new HttpException(
        {
          status: 'unhealthy',
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
