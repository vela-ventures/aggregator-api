import { dryrun } from '@permaweb/aoconnect';

// Utility Functions
export function convertToDenomination(
  amount: number,
  denomination: number,
): string {
  return Math.floor(amount * Math.pow(10, denomination)).toString();
}

export function convertFromDenomination(
  amount: number,
  denomination: number,
): number {
  return amount / Math.pow(10, denomination);
}

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

export interface SwapQuoteResponse {
  fromToken: Token;
  toToken: Token;
  inputAmount: number;
  routes: Route[];
  bestRoute: Route | null;
  totalRoutesFound: number;
  validRoutesWithEstimates: number;
  executionTime: number;
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
   * Calculates swap estimate for Botega DEX
   */
  private async calculateBotegaSwapEstimate(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress: string | undefined,
    poolId: string,
  ): Promise<SwapEstimate> {
    try {
      const tags = [
        { name: 'Action', value: 'Get-Swap-Output' },
        { name: 'Token', value: fromToken.processId },
        {
          name: 'Swapper',
          value: userAddress || '0000000000000000000000000000000000000000000',
        },
        {
          name: 'Quantity',
          value: convertToDenomination(amount, fromToken.denomination),
        },
      ];

      const result = await dryrun({
        process: poolId,
        tags,
      });

      const tagArray: { name: string; value: string }[] =
        result.Messages?.[0]?.Tags || [];
      const responseTags = Object.fromEntries(
        tagArray.map((tag) => [tag.name, tag.value]),
      );

      const fee = convertFromDenomination(
        Number(responseTags['LP-Fee-Quantity'] || 0),
        fromToken.denomination,
      );

      const output = convertFromDenomination(
        Number(responseTags['Output'] || 0),
        toToken.denomination,
      );

      return {
        fee,
        slippage: 0.5,
        out: output,
        outWithFee: output,
      };
    } catch (error) {
      throw new RouteCalculationError(
        `Failed to calculate Botega estimate: ${error}`,
      );
    }
  }

  /**
   * Estimates Permaswap output using pool reserves
   */
  private estimatePermaswapOutput(
    poolInfo: any,
    inputAmount: number,
    inputTokenId: string,
  ): { outputAmount: number; exchangeRate: number; fee: number } {
    const tags: Record<string, string> = {};
    poolInfo.Messages[0].Tags.forEach((tag: any) => {
      tags[tag.name] = tag.value;
    });

    const reserveX = Number(tags.PX);
    const reserveY = Number(tags.PY);
    const decimalX = Number(tags.DecimalX);
    const decimalY = Number(tags.DecimalY);
    const feeRate = Number(tags.Fee) / 100000;
    const tokenYId = tags.Y;

    const isXtoY = inputTokenId === tokenYId;
    const fee = inputAmount * feeRate;
    const inputAmountAfterFee = inputAmount - fee;

    let outputAmount: number;
    let exchangeRate: number;

    if (isXtoY) {
      const inputRaw = inputAmountAfterFee * Math.pow(10, decimalX);
      const k = reserveX * reserveY;
      const newReserveX = reserveX + inputRaw;
      const newReserveY = k / newReserveX;
      const outputRaw = reserveY - newReserveY;
      outputAmount = outputRaw / Math.pow(10, decimalY);
      exchangeRate = outputAmount / inputAmountAfterFee;
    } else {
      const inputRaw = inputAmountAfterFee * Math.pow(10, decimalY);
      const k = reserveX * reserveY;
      const newReserveY = reserveY + inputRaw;
      const newReserveX = k / newReserveY;
      const outputRaw = reserveX - newReserveX;
      outputAmount = outputRaw / Math.pow(10, decimalX);
      exchangeRate = outputAmount / inputAmountAfterFee;
    }

    return {
      outputAmount,
      exchangeRate,
      fee,
    };
  }

  /**
   * Calculates swap estimate for Permaswap DEX
   */
  private async calculatePermaswapSwapEstimate(
    fromToken: Token,
    toToken: Token,
    amount: number,
    poolId: string,
  ): Promise<SwapEstimate> {
    try {
      const result = await dryrun({
        process: poolId,
        tags: [{ name: 'Action', value: 'Info' }],
      });

      const permaSwapOutput = this.estimatePermaswapOutput(
        result,
        amount,
        toToken.processId,
      );

      return {
        fee: permaSwapOutput.outputAmount * 0.0005,
        slippage: 0.5,
        out: permaSwapOutput.outputAmount,
        outWithFee: permaSwapOutput.outputAmount,
      };
    } catch (error) {
      throw new RouteCalculationError(
        `Failed to calculate Permaswap estimate: ${error}`,
      );
    }
  }

  /**
   * Calculates estimate for a single hop in a route
   */
  private async calculateSingleHopEstimate(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress: string | undefined,
    poolId: string,
    dex: 'botega' | 'permaswap',
  ): Promise<SwapEstimate> {
    if (dex === 'botega') {
      return this.calculateBotegaSwapEstimate(
        fromToken,
        toToken,
        amount,
        userAddress,
        poolId,
      );
    } else {
      return this.calculatePermaswapSwapEstimate(
        fromToken,
        toToken,
        amount,
        poolId,
      );
    }
  }

  /**
   * Calculates estimates for all routes and sorts them by best output
   */
  public async calculateRouteEstimates(
    routes: Route[],
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ): Promise<Route[]> {
    const routesWithEstimates = await Promise.allSettled(
      routes.map(async (route) => {
        try {
          if (route.hops === 1) {
            // Single hop estimate
            const estimate = await this.calculateSingleHopEstimate(
              fromToken,
              toToken,
              amount,
              userAddress,
              route.pools[0].poolId,
              route.dex,
            );

            return {
              ...route,
              estimatedOutput: estimate.out,
              estimatedFee: estimate.fee,
            };
          } else if (route.hops === 2 && route.intermediateToken) {
            // Multi-hop estimate
            const firstHopEstimate = await this.calculateSingleHopEstimate(
              fromToken,
              route.intermediateToken,
              amount,
              userAddress,
              route.pools[0].poolId,
              route.dex,
            );

            const secondHopEstimate = await this.calculateSingleHopEstimate(
              route.intermediateToken,
              toToken,
              firstHopEstimate.outWithFee,
              userAddress,
              route.pools[1].poolId,
              route.dex,
            );

            return {
              ...route,
              intermediateOutput: firstHopEstimate.out,
              estimatedOutput: secondHopEstimate.out,
              estimatedFee: firstHopEstimate.fee + secondHopEstimate.fee,
            };
          } else {
            throw new Error(
              `Unsupported route configuration: ${route.hops} hops`,
            );
          }
        } catch (error) {
          console.warn(`Failed to calculate estimate for route:`, error);
          return {
            ...route,
            estimatedOutput: 0,
            estimatedFee: 0,
          };
        }
      }),
    );

    // Extract successful estimates and filter out failed ones
    const validRoutes: Route[] = [];

    for (const result of routesWithEstimates) {
      if (result.status === 'fulfilled') {
        const route = result.value;
        if (route.estimatedOutput !== undefined && route.estimatedOutput > 0) {
          validRoutes.push(route);
        }
      }
    }

    // Sort by estimated output (best first)
    return validRoutes.sort(
      (a, b) => (b.estimatedOutput || 0) - (a.estimatedOutput || 0),
    );
  }

  /**
   * Finds and ranks all routes for a token pair with estimates
   */
  public async findOptimalRoutes(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ): Promise<Route[]> {
    try {
      const allRoutes = await this.findAllRoutes(fromToken, toToken);

      if (allRoutes.length === 0) {
        return [];
      }

      return this.calculateRouteEstimates(
        allRoutes,
        fromToken,
        toToken,
        amount,
        userAddress,
      );
    } catch (error) {
      throw new RouteCalculationError('Failed to find optimal routes', error);
    }
  }

  /**
   * Gets the best route for a token pair
   */
  public async getBestRoute(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ): Promise<Route | null> {
    const routes = await this.findOptimalRoutes(
      fromToken,
      toToken,
      amount,
      userAddress,
    );
    return routes.length > 0 ? routes[0] : null;
  }

  /**
   * Complete swap quote - finds all routes, calculates estimates, and returns comprehensive data
   * This is your "do everything" function for getting swap quotes
   */
  public async getSwapQuote(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ): Promise<SwapQuoteResponse> {
    const startTime = Date.now();

    try {
      // Find all possible routes
      const allRoutes = await this.findAllRoutes(fromToken, toToken);

      // Calculate estimates for all routes and sort by best output
      const routesWithEstimates = await this.calculateRouteEstimates(
        allRoutes,
        fromToken,
        toToken,
        amount,
        userAddress,
      );

      const executionTime = Date.now() - startTime;

      return {
        fromToken,
        toToken,
        inputAmount: amount,
        routes: routesWithEstimates,
        bestRoute:
          routesWithEstimates.length > 0 ? routesWithEstimates[0] : null,
        totalRoutesFound: allRoutes.length,
        validRoutesWithEstimates: routesWithEstimates.length,
        executionTime,
      };
    } catch (error) {
      throw new RouteCalculationError('Failed to get swap quote', error);
    }
  }

  /**
   * Quick swap quote - returns only the best route (faster for simple use cases)
   */
  public async getQuickQuote(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ): Promise<{
    bestRoute: Route | null;
    estimatedOutput: number;
    estimatedFee: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const bestRoute = await this.getBestRoute(
      fromToken,
      toToken,
      amount,
      userAddress,
    );
    const executionTime = Date.now() - startTime;

    return {
      bestRoute,
      estimatedOutput: bestRoute?.estimatedOutput || 0,
      estimatedFee: bestRoute?.estimatedFee || 0,
      executionTime,
    };
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
