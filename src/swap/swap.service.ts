import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoutesService } from '../routes/routes.service';
import { EstimatesService } from '../estimates/estimates.service';
import { PoolsService } from '../pools/pools.service';
import type { SwapQuoteResponse, QuickQuoteResponse } from '../shared/types';

@Injectable()
export class SwapService implements OnModuleInit {
  private readonly logger = new Logger(SwapService.name);

  constructor(
    private readonly routesService: RoutesService,
    private readonly estimatesService: EstimatesService,
    private readonly poolsService: PoolsService,
  ) {}

  async onModuleInit() {
    this.logger.log('SwapService initialized');

    // Pre-warm the cache on startup
    try {
      await this.poolsService.getAllPools();
      this.logger.log('Pool cache pre-warmed successfully');
    } catch (error) {
      this.logger.warn('Failed to pre-warm pool cache:', error);
    }
  }

  /**
   * Get comprehensive swap quote with all routes and estimates
   */
  async getSwapQuote(
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    userAddress?: string,
  ): Promise<SwapQuoteResponse> {
    const startTime = Date.now();

    try {
      // Find all possible routes
      const allRoutes = await this.routesService.findAllRoutes(
        fromTokenId,
        toTokenId,
      );

      // Calculate estimates for all routes and sort by best output
      const routesWithEstimates =
        await this.estimatesService.calculateRouteEstimates(
          allRoutes,
          fromTokenId,
          toTokenId,
          amount,
          userAddress,
        );

      const executionTime = Date.now() - startTime;

      return {
        fromTokenId,
        toTokenId,
        inputAmount: amount,
        routes: routesWithEstimates,
        bestRoute:
          routesWithEstimates.length > 0 ? routesWithEstimates[0] : null,
        totalRoutesFound: allRoutes.length,
        validRoutesWithEstimates: routesWithEstimates.length,
        executionTime,
      };
    } catch (error) {
      this.logger.error('Failed to get swap quote:', error);
      throw error;
    }
  }

  /**
   * Get quick quote with just the best route
   */
  async getQuickQuote(
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    userAddress?: string,
  ): Promise<QuickQuoteResponse> {
    const startTime = Date.now();

    try {
      // Find all routes first
      const routes = await this.routesService.findAllRoutes(
        fromTokenId,
        toTokenId,
      );

      // Calculate estimates for all routes
      const routesWithEstimates =
        await this.estimatesService.calculateRouteEstimates(
          routes,
          fromTokenId,
          toTokenId,
          amount,
          userAddress,
        );

      // Get the best route
      const bestRoute = this.estimatesService.getBestRoute(routesWithEstimates);
      const executionTime = Date.now() - startTime;

      return {
        bestRoute,
        estimatedOutput: bestRoute?.estimatedOutput || 0,
        estimatedFee: bestRoute?.estimatedFee || 0,
        executionTime,
      };
    } catch (error) {
      this.logger.error('Failed to get quick quote:', error);
      throw error;
    }
  }

  /**
   * Get all available pools
   */
  async getAllPools(forceRefresh = false) {
    try {
      return await this.poolsService.getAllPools(forceRefresh);
    } catch (error) {
      this.logger.error('Failed to get all pools:', error);
      throw error;
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return this.poolsService.getCacheStatus();
  }

  /**
   * Invalidate cache manually
   */
  invalidateCache() {
    this.poolsService.invalidateCache();
    this.logger.log('Pool cache invalidated');
  }
}
