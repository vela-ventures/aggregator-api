import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { SwapAggregatorService } from './swap/lib/swap-aggregator.service';

// Simple DTOs for the API
interface TokenRequest {
  processId: string;
  symbol?: string;
  name?: string;
  denomination?: number;
}

interface SwapQuoteRequest {
  fromToken: TokenRequest;
  toToken: TokenRequest;
  amount: number;
  userAddress?: string;
}

@ApiTags('Swap Aggregator API')
@Controller()
export class AppController {
  constructor(private readonly swapService: SwapAggregatorService) {}

  @Get()
  @ApiOperation({ summary: 'API Health Check' })
  @ApiResponse({ status: 200, description: 'API is running' })
  getStatus() {
    return {
      status: 'ok',
      message: 'Swap Aggregator API is running',
      timestamp: new Date().toISOString(),
    };
  }

  // POOLS ENDPOINTS
  @Get('pools')
  @ApiOperation({ summary: 'Get all available pools from supported DEXes' })
  @ApiQuery({
    name: 'refresh',
    required: false,
    description: 'Force refresh cache',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns pools from Botega and Permaswap',
  })
  async getPools(@Query('refresh') refresh?: boolean) {
    try {
      return await this.swapService.getAllPools(refresh || false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        { message: 'Failed to fetch pools', error: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('pools/cache')
  @ApiOperation({ summary: 'Get pools cache status' })
  @ApiResponse({ status: 200, description: 'Cache status information' })
  getCacheStatus() {
    return this.swapService.getCacheStatus();
  }

  @Post('pools/refresh')
  @ApiOperation({ summary: 'Force refresh pools cache' })
  @ApiResponse({ status: 200, description: 'Cache refreshed successfully' })
  async refreshPools() {
    try {
      await this.swapService.getAllPools(true);
      this.swapService.invalidateCache();
      return { message: 'Pools cache refreshed successfully' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        { message: 'Failed to refresh pools', error: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ROUTES ENDPOINTS
  @Get('routes')
  @ApiOperation({ summary: 'Find all possible routes between two tokens' })
  @ApiQuery({
    name: 'fromToken',
    required: true,
    description: 'Source token process ID',
  })
  @ApiQuery({
    name: 'toToken',
    required: true,
    description: 'Destination token process ID',
  })
  @ApiQuery({
    name: 'fromSymbol',
    required: false,
    description: 'Source token symbol',
  })
  @ApiQuery({
    name: 'toSymbol',
    required: false,
    description: 'Destination token symbol',
  })
  @ApiResponse({ status: 200, description: 'All available routes' })
  async getRoutes(
    @Query('fromToken') fromToken: string,
    @Query('toToken') toToken: string,
    @Query('fromSymbol') fromSymbol?: string,
    @Query('toSymbol') toSymbol?: string,
  ) {
    if (!fromToken || !toToken) {
      throw new HttpException(
        'fromToken and toToken are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const fromTokenObj = {
        processId: fromToken,
        denomination: 12,
        symbol: fromSymbol,
      };

      const toTokenObj = {
        processId: toToken,
        denomination: 12,
        symbol: toSymbol,
      };

      return await this.swapService.findAllRoutes(fromTokenObj, toTokenObj);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        { message: 'Failed to find routes', error: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // QUOTES ENDPOINTS
  @Get('quote')
  @ApiOperation({ summary: 'Get the best swap quote' })
  @ApiQuery({
    name: 'fromToken',
    required: true,
    description: 'Source token process ID',
  })
  @ApiQuery({
    name: 'toToken',
    required: true,
    description: 'Destination token process ID',
  })
  @ApiQuery({ name: 'amount', required: true, description: 'Amount to swap' })
  @ApiQuery({
    name: 'userAddress',
    required: false,
    description: 'User wallet address',
  })
  @ApiResponse({ status: 200, description: 'Best swap route with estimate' })
  async getQuote(
    @Query('fromToken') fromToken: string,
    @Query('toToken') toToken: string,
    @Query('amount') amount: string,
    @Query('userAddress') userAddress?: string,
  ) {
    if (!fromToken || !toToken || !amount) {
      throw new HttpException(
        'fromToken, toToken, and amount are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const fromTokenObj = {
        processId: fromToken,
        denomination: 12,
      };

      const toTokenObj = {
        processId: toToken,
        denomination: 12,
      };

      return await this.swapService.getBestRoute(
        fromTokenObj,
        toTokenObj,
        parseFloat(amount),
        userAddress,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        { message: 'Failed to get quote', error: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('quote')
  @ApiOperation({ summary: 'Get detailed swap quote with all routes' })
  @ApiBody({
    description: 'Swap quote request',
    schema: {
      type: 'object',
      properties: {
        fromToken: {
          type: 'object',
          properties: {
            processId: { type: 'string', example: 'AO-process-id' },
            symbol: { type: 'string', example: 'AO' },
            name: { type: 'string', example: 'AO Token' },
            denomination: { type: 'number', example: 12 },
          },
          required: ['processId'],
        },
        toToken: {
          type: 'object',
          properties: {
            processId: { type: 'string', example: 'wAR-process-id' },
            symbol: { type: 'string', example: 'wAR' },
            name: { type: 'string', example: 'Wrapped AR' },
            denomination: { type: 'number', example: 12 },
          },
          required: ['processId'],
        },
        amount: { type: 'number', example: 1000 },
        userAddress: { type: 'string', example: 'wallet-address' },
      },
      required: ['fromToken', 'toToken', 'amount'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed quote with all routes and estimates',
  })
  async getDetailedQuote(@Body() body: SwapQuoteRequest) {
    try {
      // Set default denomination if not provided
      const fromToken = { denomination: 12, ...body.fromToken };
      const toToken = { denomination: 12, ...body.toToken };

      return await this.swapService.getSwapQuote(
        fromToken,
        toToken,
        body.amount,
        body.userAddress,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        { message: 'Failed to get detailed quote', error: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('quote/quick')
  @ApiOperation({ summary: 'Get quick quote (fastest response)' })
  @ApiQuery({
    name: 'fromToken',
    required: true,
    description: 'Source token process ID',
  })
  @ApiQuery({
    name: 'toToken',
    required: true,
    description: 'Destination token process ID',
  })
  @ApiQuery({ name: 'amount', required: true, description: 'Amount to swap' })
  @ApiQuery({
    name: 'userAddress',
    required: false,
    description: 'User wallet address',
  })
  @ApiResponse({ status: 200, description: 'Quick quote with best route only' })
  async getQuickQuote(
    @Query('fromToken') fromToken: string,
    @Query('toToken') toToken: string,
    @Query('amount') amount: string,
    @Query('userAddress') userAddress?: string,
  ) {
    if (!fromToken || !toToken || !amount) {
      throw new HttpException(
        'fromToken, toToken, and amount are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const fromTokenObj = {
        processId: fromToken,
        denomination: 12,
      };

      const toTokenObj = {
        processId: toToken,
        denomination: 12,
      };

      return await this.swapService.getQuickQuote(
        fromTokenObj,
        toTokenObj,
        parseFloat(amount),
        userAddress,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        { message: 'Failed to get quick quote', error: errorMessage },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
