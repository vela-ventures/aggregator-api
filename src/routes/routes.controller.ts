import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  async getRoutes(
    @Query('fromToken') fromTokenId: string,
    @Query('toToken') toTokenId: string,
  ) {
    if (!fromTokenId || !toTokenId) {
      throw new BadRequestException('fromToken and toToken are required');
    }

    return await this.routesService.findAllRoutes(fromTokenId, toTokenId);
  }
}
