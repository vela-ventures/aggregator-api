import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { dryrun } from '@permaweb/aoconnect';
import { RoutesService } from '../routes/routes.service';
import { EstimatesService } from '../estimates/estimates.service';
import { PoolsService } from '../pools/pools.service';
import { AGGREGATOR_ID } from '../app-config';
import type {
  SwapQuoteResponse,
  QuickQuoteResponse,
  ReverseSwapEstimate,
  ReverseQuoteResponse,
} from '../shared/types';

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

    try {
      await this.poolsService.getAllPools();
      this.logger.log('Pool cache pre-warmed successfully');
    } catch (error) {
      this.logger.warn('Failed to pre-warm pool cache:', error);
    }
  }

  async getSwapQuote(
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    userAddress?: string,
  ): Promise<SwapQuoteResponse> {
    const startTime = Date.now();

    try {
      const allRoutes = await this.routesService.findAllRoutes(
        fromTokenId,
        toTokenId,
      );

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

  async getSwapStatus(swapId: string) {
    try {
      const statusResult = await dryrun({
        process: AGGREGATOR_ID,
        data: '',
        tags: [
          { name: 'Action', value: 'Status' },
          { name: 'Swap-Id', value: swapId },
        ],
      });

      this.logger.log('Status result for swap ID:', swapId);
      if (
        statusResult?.Messages &&
        statusResult?.Messages[0] &&
        statusResult?.Messages[0].Tags
      ) {
        const message = statusResult.Messages[0];
        const tagArray: { name: string; value: string }[] = message.Tags || [];

        const responseTags = Object.fromEntries(
          tagArray.map((tag) => [tag.name, tag.value]),
        );

        if (responseTags['Swap-status']) {
          return {
            swapId,
            status: responseTags['Swap-status'],
            ...responseTags,
          };
        }
      }

      throw new Error('Status not available');
    } catch (error) {
      this.logger.error('Error getting swap status:', error);
      return {
        swapId,
        status: 'not-found',
      };
    }
  }

  async getAllPools(forceRefresh = false) {
    try {
      return await this.poolsService.getAllPools(forceRefresh);
    } catch (error) {
      this.logger.error('Failed to get all pools:', error);
      throw error;
    }
  }

  getCacheStatus() {
    return this.poolsService.getCacheStatus();
  }

  invalidateCache() {
    this.poolsService.invalidateCache();
    this.logger.log('Pool cache invalidated');
  }

  async getReverseQuote(
    fromTokenId: string,
    toTokenId: string,
    desiredOutput: number,
    userAddress?: string,
  ): Promise<ReverseQuoteResponse> {
    const startTime = Date.now();

    try {
      const allRoutes = await this.routesService.findAllRoutes(
        fromTokenId,
        toTokenId,
      );

      const routesWithReverseEstimates =
        await this.estimatesService.calculateReverseRouteEstimates(
          allRoutes,
          fromTokenId,
          toTokenId,
          desiredOutput,
          userAddress,
        );

      const executionTime = Date.now() - startTime;

      return {
        fromTokenId,
        toTokenId,
        desiredOutput,
        routes: routesWithReverseEstimates,
        bestRoute:
          routesWithReverseEstimates.length > 0
            ? routesWithReverseEstimates[0]
            : null,
        totalRoutesFound: allRoutes.length,
        validRoutesWithEstimates: routesWithReverseEstimates.length,
        executionTime,
      };
    } catch (error) {
      this.logger.error('Failed to get reverse quote:', error);
      throw error;
    }
  }

  async calculateReverseEstimate(
    fromTokenId: string,
    toTokenId: string,
    desiredOutput: number,
    poolId: string,
    dex: 'botega' | 'permaswap',
    userAddress?: string,
  ): Promise<ReverseSwapEstimate> {
    try {
      return await this.estimatesService.calculateReverseEstimate(
        fromTokenId,
        toTokenId,
        desiredOutput,
        poolId,
        dex,
        userAddress,
      );
    } catch (error) {
      this.logger.error('Failed to calculate reverse estimate:', error);
      throw error;
    }
  }
}
