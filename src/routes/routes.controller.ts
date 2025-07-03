import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import type { Token } from './routes.service';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  async getRoutes(
    @Query('fromToken') fromTokenId: string,
    @Query('toToken') toTokenId: string,
    @Query('fromDenomination') fromDenomination?: string,
    @Query('toDenomination') toDenomination?: string,
    @Query('fromSymbol') fromSymbol?: string,
    @Query('toSymbol') toSymbol?: string,
  ) {
    if (!fromTokenId || !toTokenId) {
      throw new BadRequestException('fromToken and toToken are required');
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

    return await this.routesService.findAllRoutes(fromToken, toToken);
  }
}
