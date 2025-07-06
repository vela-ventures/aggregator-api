import { Injectable, Logger } from '@nestjs/common';
import type { PoolData } from '../pools/pools.service';
import { PoolsService } from '../pools/pools.service';

export interface Token {
  processId: string;
  denomination: number;
  symbol?: string;
  name?: string;
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
  intermediateToken?: Token;
}

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  private readonly intermediateTokens: Token[] = [
    {
      processId: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
      denomination: 12,
      symbol: 'wAR',
      name: 'Wrapped AR',
    },
  ];

  constructor(private readonly poolsService: PoolsService) {}

  async findAllRoutes(fromToken: Token, toToken: Token): Promise<Route[]> {
    try {
      const poolData = await this.poolsService.getAllPools();

      const directRoutes = this.findDirectRoutes(
        fromToken.processId,
        toToken.processId,
        poolData,
      );

      let multiHopRoutes: Route[] = [];
      if (directRoutes.length === 0) {
        console.log('looking for multihop');
        multiHopRoutes = this.findMultiHopRoutes(
          fromToken.processId,
          toToken.processId,
          poolData,
        );
      }

      const allRoutes = [...directRoutes, ...multiHopRoutes];
      this.logger.log(
        `Found ${allRoutes.length} routes for ${fromToken.symbol} -> ${toToken.symbol}`,
      );

      console.log('about to return');
      return allRoutes;
    } catch (error) {
      this.logger.error('Failed to find routes:', error);
      throw error;
    }
  }

  private findDirectRoutes(
    tokenA: string,
    tokenB: string,
    poolData: PoolData,
  ): Route[] {
    const routes: Route[] = [];

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

  private findMultiHopRoutes(
    tokenA: string,
    tokenB: string,
    poolData: PoolData,
  ): Route[] {
    const routes: Route[] = [];

    for (const intermediateToken of this.intermediateTokens) {
      const intermediateId = intermediateToken.processId;

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
    console.log('found multiphop ');
    console.log(routes);
    return routes;
  }

  setIntermediateTokens(tokens: Token[]): void {
    this.intermediateTokens.length = 0;
    this.intermediateTokens.push(...tokens);
    this.logger.log(
      `Updated intermediate tokens: ${tokens.map((t) => t.symbol).join(', ')}`,
    );
  }
}
