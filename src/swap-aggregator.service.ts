import { dryrun } from '@permaweb/aoconnect';

// Types and Interfaces
export interface Token {
  processId: string;
  denomination: number;
  symbol?: string;
  name?: string;
}

export interface BotegaPool {
  poolId: string;
  tokenA: string;
  tokenB: string;
}

export interface PermaswapPool {
  process: string;
  x: string;
  y: string;
  fee: string;
}

export interface PoolData {
  botegaPools: BotegaPool[];
  permaswapPools: PermaswapPool[];
}

export interface RoutePool {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  fee?: string;
}

export interface Route {
  dex: 'botega' | 'permaswap';
  pools: RoutePool[];
  hops: number;
  estimatedOutput?: number;
  intermediateOutput?: number;
  estimatedFee?: number;
  intermediateToken?: Token;
}

export interface SwapEstimate {
  fee: number;
  slippage: number;
  out: number;
  outWithFee: number;
}

// Configuration
export interface SwapAggregatorConfig {
  cacheExpirationMs?: number;
  maxHops?: number;
  botegaProcessId?: string;
  permaswapProcessId?: string;
  intermediateTokens?: Token[];
}

const DEFAULT_CONFIG: Required<SwapAggregatorConfig> = {
  cacheExpirationMs: 5 * 60 * 1000, // 5 minutes
  maxHops: 2,
  botegaProcessId: '3XBGLrygs11K63F_7mldWz4veNx6Llg6hI2yZs8LKHo',
  permaswapProcessId: '5G5_ftQT6f2OsmJ8EZ4-84eRcIMNEmUyH9aQSD85f9I',
  intermediateTokens: [], // Should be provided by the consumer
};

// Custom Errors
export class PoolFetchError extends Error {
  constructor(dex: string, originalError: unknown) {
    super(`Failed to fetch ${dex} pools: ${originalError}`);
    this.name = 'PoolFetchError';
  }
}

export class RouteCalculationError extends Error {
  constructor(message: string, originalError?: unknown) {
    super(`Route calculation failed: ${message}`);
    this.name = 'RouteCalculationError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Swap Aggregator Service
 *
 * Provides functionality to:
 * - Fetch and cache pool data from multiple DEXes
 * - Find optimal trading routes (direct and multi-hop)
 * - Calculate swap estimates
 */
export class SwapAggregatorService {
  private readonly config: Required<SwapAggregatorConfig>;
  private poolsCache: PoolData | null = null;
  private lastPoolsFetchTime = 0;

  constructor(config: SwapAggregatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Fetches all pools from Botega DEX
   */
  private async fetchBotegaPools(): Promise<BotegaPool[]> {
    try {
      const result = await dryrun({
        process: this.config.botegaProcessId,
        tags: [{ name: 'Action', value: 'Get-Pools' }],
      });

      const poolsData = result.Messages?.[0]?.Data;
      if (!poolsData) {
        throw new Error('No pools data received from Botega');
      }

      const parsedData = JSON.parse(poolsData);
      const pools: BotegaPool[] = [];

      Object.entries(parsedData).forEach(([poolId, tokens]) => {
        if (Array.isArray(tokens) && tokens.length === 2) {
          pools.push({
            poolId,
            tokenA: tokens[0] as string,
            tokenB: tokens[1] as string,
          });
        }
      });

      return pools;
    } catch (error) {
      throw new PoolFetchError('Botega', error);
    }
  }

  /**
   * Fetches all pools from Permaswap DEX
   */
  private async fetchPermaswapPools(): Promise<PermaswapPool[]> {
    try {
      const result = await dryrun({
        process: this.config.permaswapProcessId,
        tags: [{ name: 'Action', value: 'GetAllPools' }],
      });

      const poolsData = result.Messages?.[0]?.Data;
      if (!poolsData) {
        throw new Error('No pools data received from Permaswap');
      }

      const parsedData = JSON.parse(poolsData);
      const pools: PermaswapPool[] = [];

      Object.values(parsedData).forEach((pool: any) => {
        if (pool?.X && pool?.Y && pool?.Process && pool?.Fee) {
          pools.push({
            process: pool.Process,
            x: pool.X,
            y: pool.Y,
            fee: pool.Fee,
          });
        }
      });

      return pools;
    } catch (error) {
      throw new PoolFetchError('Permaswap', error);
    }
  }

  /**
   * Fetches all pools from both DEXes with caching
   */
  public async getAllPools(forceRefresh = false): Promise<PoolData> {
    const now = Date.now();
    const isCacheValid =
      !forceRefresh &&
      this.poolsCache &&
      now - this.lastPoolsFetchTime < this.config.cacheExpirationMs;

    if (isCacheValid) {
      return this.poolsCache!;
    }

    try {
      const [botegaPools, permaswapPools] = await Promise.all([
        this.fetchBotegaPools(),
        this.fetchPermaswapPools(),
      ]);

      this.poolsCache = { botegaPools, permaswapPools };
      this.lastPoolsFetchTime = now;

      return this.poolsCache;
    } catch (error) {
      // If we have cached data and fetch fails, return cached data
      if (this.poolsCache) {
        console.warn('Pool fetch failed, returning cached data:', error);
        return this.poolsCache;
      }
      throw error;
    }
  }

  /**
   * Finds direct pools for a token pair
   */
  public findDirectRoutes(
    tokenA: string,
    tokenB: string,
    poolData: PoolData,
  ): Route[] {
    const routes: Route[] = [];

    // Check Botega pools
    const botegaPool = poolData.botegaPools.find(
      (pool) =>
        (pool.tokenA === tokenA && pool.tokenB === tokenB) ||
        (pool.tokenA === tokenB && pool.tokenB === tokenA),
    );

    if (botegaPool) {
      routes.push({
        dex: 'botega',
        pools: [
          {
            poolId: botegaPool.poolId,
            tokenIn: tokenA,
            tokenOut: tokenB,
          },
        ],
        hops: 1,
      });
    }

    // Check Permaswap pools (only fee: "100" pools)
    const permaswapPool = poolData.permaswapPools.find(
      (pool) =>
        pool.fee === '100' &&
        ((pool.x === tokenA && pool.y === tokenB) ||
          (pool.x === tokenB && pool.y === tokenA)),
    );

    if (permaswapPool) {
      routes.push({
        dex: 'permaswap',
        pools: [
          {
            poolId: permaswapPool.process,
            tokenIn: tokenA,
            tokenOut: tokenB,
            fee: permaswapPool.fee,
          },
        ],
        hops: 1,
      });
    }

    return routes;
  }

  /**
   * Finds multi-hop routes through intermediate tokens
   */
  public findMultiHopRoutes(
    tokenA: string,
    tokenB: string,
    poolData: PoolData,
  ): Route[] {
    const routes: Route[] = [];

    for (const intermediateToken of this.config.intermediateTokens) {
      const intermediateId = intermediateToken.processId;

      // Skip if intermediate token is same as input/output
      if (intermediateId === tokenA || intermediateId === tokenB) {
        continue;
      }

      const firstHopRoutes = this.findDirectRoutes(
        tokenA,
        intermediateId,
        poolData,
      );
      const secondHopRoutes = this.findDirectRoutes(
        intermediateId,
        tokenB,
        poolData,
      );

      // Create multi-hop routes (prefer same DEX for simplicity)
      for (const firstHop of firstHopRoutes) {
        for (const secondHop of secondHopRoutes) {
          if (firstHop.dex === secondHop.dex) {
            routes.push({
              dex: firstHop.dex,
              pools: [...firstHop.pools, ...secondHop.pools],
              intermediateToken,
              hops: 2,
            });
          }
        }
      }
    }

    return routes;
  }

  /**
   * Finds all possible routes for a token pair
   */
  public async findAllRoutes(
    fromToken: Token,
    toToken: Token,
  ): Promise<Route[]> {
    try {
      const poolData = await this.getAllPools();

      // Always get direct routes
      const directRoutes = this.findDirectRoutes(
        fromToken.processId,
        toToken.processId,
        poolData,
      );

      // Only look for multi-hop routes if no direct routes found
      let multiHopRoutes: Route[] = [];
      if (directRoutes.length === 0) {
        multiHopRoutes = this.findMultiHopRoutes(
          fromToken.processId,
          toToken.processId,
          poolData,
        );
      }

      return [...directRoutes, ...multiHopRoutes];
    } catch (error) {
      throw new RouteCalculationError('Failed to find routes', error);
    }
  }

  /**
   * Invalidates the pools cache
   */
  public invalidateCache(): void {
    this.poolsCache = null;
    this.lastPoolsFetchTime = 0;
  }

  /**
   * Gets cache status
   */
  public getCacheStatus(): {
    isCached: boolean;
    lastFetchTime: number;
    isExpired: boolean;
  } {
    const now = Date.now();
    const isExpired =
      now - this.lastPoolsFetchTime >= this.config.cacheExpirationMs;

    return {
      isCached: this.poolsCache !== null,
      lastFetchTime: this.lastPoolsFetchTime,
      isExpired,
    };
  }

  /**
   * Updates configuration
   */
  public updateConfig(newConfig: Partial<SwapAggregatorConfig>): void {
    Object.assign(this.config, newConfig);
  }
}
