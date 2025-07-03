import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import type { Token } from '../routes/routes.service';
import { SwapAggregatorService } from '../swap/lib/swap-aggregator.service';

@Controller('estimates')
export class EstimatesController {
  constructor(private readonly swapAggregatorService: SwapAggregatorService) {}

  @Get('best')
  async getBestRoute(
    @Query('fromToken') fromTokenId: string,
    @Query('toToken') toTokenId: string,
    @Query('amount') amount: string,
    @Query('fromDenomination') fromDenomination?: string,
    @Query('toDenomination') toDenomination?: string,
    @Query('fromSymbol') fromSymbol?: string,
    @Query('toSymbol') toSymbol?: string,
    @Query('userAddress') userAddress?: string,
  ) {
    if (!fromTokenId || !toTokenId || !amount) {
      throw new BadRequestException(
        'fromToken, toToken, and amount are required',
      );
    }

    const fromToken: Token = {
      processId: fromTokenId,
      denomination: fromDenomination ? parseInt(fromDenomination) : 12,
      symbol: fromSymbol,
    };

    const toToken: Token = {
      processId: toTokenId,
      denomination: toDenomination ? parseInt(toDenomination) : 12,
      symbol: toSymbol,
    };

    return await this.swapAggregatorService.getBestRoute(
      fromToken,
      toToken,
      parseFloat(amount),
      userAddress,
    );
  }

  @Get('all')
  async getAllRoutes(
    @Query('fromToken') fromTokenId: string,
    @Query('toToken') toTokenId: string,
    @Query('amount') amount: string,
    @Query('fromDenomination') fromDenomination?: string,
    @Query('toDenomination') toDenomination?: string,
    @Query('fromSymbol') fromSymbol?: string,
    @Query('toSymbol') toSymbol?: string,
    @Query('userAddress') userAddress?: string,
  ) {
    if (!fromTokenId || !toTokenId || !amount) {
      throw new BadRequestException(
        'fromToken, toToken, and amount are required',
      );
    }

    const fromToken: Token = {
      processId: fromTokenId,
      denomination: fromDenomination ? parseInt(fromDenomination) : 12,
      symbol: fromSymbol,
    };

    const toToken: Token = {
      processId: toTokenId,
      denomination: toDenomination ? parseInt(toDenomination) : 12,
      symbol: toSymbol,
    };

    // Find all routes first
    const routes = await this.swapAggregatorService.findAllRoutes(
      fromToken,
      toToken,
    );

    // Then calculate estimates for all routes
    return await this.swapAggregatorService.calculateRouteEstimates(
      routes,
      fromToken,
      toToken,
      parseFloat(amount),
      userAddress,
    );
  }
}
