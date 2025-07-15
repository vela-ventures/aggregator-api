import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { RoutesService } from '../routes/routes.service';
import { EstimatesService } from './estimates.service';

@Controller('estimates')
export class EstimatesController {
  constructor(
    private readonly routesService: RoutesService,
    private readonly estimatesService: EstimatesService,
  ) {}

  @Get('best')
  async getBestEstimate(
    @Query('fromToken') fromTokenId: string,
    @Query('toToken') toTokenId: string,
    @Query('amount') amount: string,
    @Query('userAddress') userAddress?: string,
  ) {
    if (!fromTokenId || !toTokenId || !amount) {
      throw new BadRequestException(
        'fromToken, toToken, and amount are required',
      );
    }

    const routes = await this.routesService.findAllRoutes(
      fromTokenId,
      toTokenId,
    );

    const routesWithEstimates =
      await this.estimatesService.calculateRouteEstimates(
        routes,
        fromTokenId,
        toTokenId,
        parseFloat(amount),
        userAddress,
      );

    const bestRoute = this.estimatesService.getBestRoute(routesWithEstimates);

    if (!bestRoute) {
      throw new BadRequestException('No valid routes found');
    }

    return {
      route: bestRoute,
      estimatedOutput: bestRoute.estimatedOutput,
      estimatedFee: bestRoute.estimatedFee,
    };
  }

  @Get('all')
  async getAllEstimates(
    @Query('fromToken') fromTokenId: string,
    @Query('toToken') toTokenId: string,
    @Query('amount') amount: string,
    @Query('userAddress') userAddress?: string,
  ) {
    if (!fromTokenId || !toTokenId || !amount) {
      throw new BadRequestException(
        'fromToken, toToken, and amount are required',
      );
    }

    const routes = await this.routesService.findAllRoutes(
      fromTokenId,
      toTokenId,
    );

    const routesWithEstimates =
      await this.estimatesService.calculateRouteEstimates(
        routes,
        fromTokenId,
        toTokenId,
        parseFloat(amount),
        userAddress,
      );

    return {
      routes: routesWithEstimates,
      count: routesWithEstimates.length,
    };
  }
}
