import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SwapAggregatorService,
  Token,
  SwapQuoteResponse,
} from './lib/swap-aggregator.service';

@Injectable()
export class SwapService implements OnModuleInit {
  private readonly logger = new Logger(SwapService.name);
  private aggregatorService: SwapAggregatorService;

  constructor() {
    // Initialize with default intermediate tokens - you can customize these
    const intermediateTokens: Token[] = [
      {
        processId: 'INTERMEDIATE_TOKEN_1_PROCESS_ID', // Replace with actual
        denomination: 12,
        symbol: 'wAR',
        name: 'Wrapped AR',
      },
      {
        processId: 'INTERMEDIATE_TOKEN_2_PROCESS_ID', // Replace with actual
        denomination: 6,
        symbol: 'USDC',
        name: 'USD Coin',
      },
    ];

    this.aggregatorService = new SwapAggregatorService({
      cacheExpirationMs: 5 * 60 * 1000, // 5 minutes
      maxHops: 2,
      intermediateTokens,
      // You can override process IDs if needed
      // botegaProcessId: 'custom_botega_process_id',
      // permaswapProcessId: 'custom_permaswap_process_id',
    });
  }

  async onModuleInit() {
    this.logger.log('SwapService initialized');

    // Pre-warm the cache on startup
    try {
      await this.aggregatorService.getAllPools();
      this.logger.log('Pool cache pre-warmed successfully');
    } catch (error) {
      this.logger.warn('Failed to pre-warm pool cache:', error);
    }
  }

  /**
   * Get comprehensive swap quote with all routes and estimates
   */
  async getSwapQuote(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ): Promise<SwapQuoteResponse> {
    try {
      return await this.aggregatorService.getSwapQuote(
        fromToken,
        toToken,
        amount,
        userAddress,
      );
    } catch (error) {
      this.logger.error('Failed to get swap quote:', error);
      throw error;
    }
  }

  /**
   * Get quick quote with just the best route
   */
  async getQuickQuote(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ) {
    try {
      return await this.aggregatorService.getQuickQuote(
        fromToken,
        toToken,
        amount,
        userAddress,
      );
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
      return await this.aggregatorService.getAllPools(forceRefresh);
    } catch (error) {
      this.logger.error('Failed to get all pools:', error);
      throw error;
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return this.aggregatorService.getCacheStatus();
  }

  /**
   * Invalidate cache manually
   */
  invalidateCache() {
    this.aggregatorService.invalidateCache();
    this.logger.log('Pool cache invalidated');
  }

  /**
   * Update configuration
   */
  updateConfig(config: any) {
    this.aggregatorService.updateConfig(config);
    this.logger.log('Aggregator configuration updated');
  }
}
