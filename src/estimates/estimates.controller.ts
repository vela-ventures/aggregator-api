import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import type { Token } from '../routes/routes.service';
import { RoutesService } from '../routes/routes.service';
import { EstimatesService } from './estimates.service';

@Controller('estimates')
export class EstimatesController {
  constructor(
    private readonly routesService: RoutesService,
    private readonly estimatesService: EstimatesService,
  ) {}

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

    const routes = await this.routesService.findAllRoutes(fromToken, toToken);

    const routesWithEstimates =
      await this.estimatesService.calculateRouteEstimates(
        routes,
        fromToken,
        toToken,
        parseFloat(amount),
        userAddress,
      );

    return this.estimatesService.getBestRoute(routesWithEstimates);
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

    const routes = await this.routesService.findAllRoutes(fromToken, toToken);

    return await this.estimatesService.calculateRouteEstimates(
      routes,
      fromToken,
      toToken,
      parseFloat(amount),
      userAddress,
    );
  }
}
