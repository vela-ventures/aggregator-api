import { Injectable, Logger } from '@nestjs/common';
import type { PoolData } from '../pools/pools.service';
import { PoolsService } from '../pools/pools.service';

export { Token } from '../shared/types';

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
  intermediateTokenId?: string;
}

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  // Common intermediate tokens for multi-hop routing
  private readonly intermediateTokenIds: string[] = [
    // 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
    '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc',
    'FBt9A5GA_KXMMSxA2DJ0xZbAq8sLLU2ak-YJe9zDvg8',
  ];

  constructor(private readonly poolsService: PoolsService) {}

  async findAllRoutes(
    fromTokenId: string,
    toTokenId: string,
  ): Promise<Route[]> {
    try {
      const poolData = await this.poolsService.getAllPools();

      const directRoutes = this.findDirectRoutes(
        fromTokenId,
        toTokenId,
        poolData,
      );

      let multiHopRoutes: Route[] = [];
      if (directRoutes.length === 0) {
        multiHopRoutes = this.findMultiHopRoutes(
          fromTokenId,
          toTokenId,
          poolData,
        );
      }

      const allRoutes = [...directRoutes, ...multiHopRoutes];
      this.logger.log(
        `Found ${allRoutes.length} routes for ${fromTokenId} -> ${toTokenId}`,
      );

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
        pool.poolStatus === 'certified' &&
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

    for (const intermediateTokenId of this.intermediateTokenIds) {
      if (intermediateTokenId === tokenA || intermediateTokenId === tokenB) {
        continue;
      }

      const firstHopRoutes = this.findDirectRoutes(
        tokenA,
        intermediateTokenId,
        poolData,
      );
      const secondHopRoutes = this.findDirectRoutes(
        intermediateTokenId,
        tokenB,
        poolData,
      );

      for (const firstHop of firstHopRoutes) {
        for (const secondHop of secondHopRoutes) {
          if (firstHop.dex === secondHop.dex) {
            routes.push({
              dex: firstHop.dex,
              pools: [...firstHop.pools, ...secondHop.pools],
              intermediateTokenId,
              hops: 2,
            });
          }
        }
      }
    }

    return routes;
  }

  setIntermediateTokens(tokens: string[]): void {
    this.intermediateTokenIds.length = 0;
    this.intermediateTokenIds.push(...tokens);
    this.logger.log(`Updated intermediate tokens: ${tokens.join(', ')}`);
  }
}
