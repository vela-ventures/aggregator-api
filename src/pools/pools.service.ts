import { Injectable, Logger } from '@nestjs/common';
import { dryrun } from '@permaweb/aoconnect';
import type { DryrunResult } from '../shared/types';
import { HARDCODED_BOTEGA_POOLS, BotegaPoolData } from './botega-pools-data';

interface BotegaPool {
  poolId: string;
  tokenA: string;
  tokenB: string;
}

interface PermaswapPool {
  process: string;
  x: string;
  y: string;
  fee: string;
}

export interface PoolData {
  botegaPools: BotegaPool[];
  permaswapPools: PermaswapPool[];
}

export interface CacheStatus {
  lastFetch: number;
  cacheAge: number;
  hasData: boolean;
}

@Injectable()
export class PoolsService {
  private readonly logger = new Logger(PoolsService.name);

  private botegaPoolsCache: BotegaPool[] = [];
  private permaswapPoolsCache: PermaswapPool[] = [];
  private lastPoolsFetch = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  async getAllPools(forceRefresh = false): Promise<PoolData> {
    const now = Date.now();

    if (
      !forceRefresh &&
      now - this.lastPoolsFetch < this.CACHE_DURATION &&
      this.botegaPoolsCache.length > 0
    ) {
      return {
        botegaPools: this.botegaPoolsCache,
        permaswapPools: this.permaswapPoolsCache,
      };
    }

    try {
      const [botegaPools, permaswapPools] = await Promise.all([
        this.fetchBotegaPools(),
        this.fetchPermaswapPools(),
      ]);

      this.botegaPoolsCache = botegaPools;
      this.permaswapPoolsCache = permaswapPools;
      this.lastPoolsFetch = now;

      this.logger.log(
        `Fetched ${botegaPools.length} Botega pools and ${permaswapPools.length} Permaswap pools`,
      );

      return {
        botegaPools,
        permaswapPools,
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch pools, returning cached data if available:',
        error,
      );

      return {
        botegaPools: this.botegaPoolsCache,
        permaswapPools: this.permaswapPoolsCache,
      };
    }
  }

  private async fetchBotegaPools(): Promise<BotegaPool[]> {
    try {
      // OLD LOGIC - commented out due to limitations with fee detection
      // const result = await dryrun({
      //   process: '3XBGLrygs11K63F_7mldWz4veNx6Llg6hI2yZs8LKHo',
      //   tags: [
      //     {
      //       name: 'Action',
      //       value: 'Get-Pools',
      //     },
      //   ],
      // });

      // const poolsData = (result as DryrunResult).Messages[0]?.Data;
      // if (!poolsData) return [];

      // const pools: BotegaPool[] = [];
      // Object.entries(JSON.parse(poolsData)).forEach(
      //   ([poolId, tokens]: [poolId: string, tokens: string[]]) => {
      //     if (Array.isArray(tokens) && tokens.length === 2) {
      //       pools.push({
      //         poolId,
      //         tokenA: tokens[0],
      //         tokenB: tokens[1],
      //       });
      //     }
      //   },
      // );

      // return pools;

      const poolsByPair = new Map<string, BotegaPoolData>();

      HARDCODED_BOTEGA_POOLS.forEach((pool) => {
        if (pool.pool_fee_bps === null) {
          return;
        }

        const tokens = [pool.token0, pool.token1].sort();
        const pairKey = `${tokens[0]}-${tokens[1]}`;

        const existingPool = poolsByPair.get(pairKey);
        if (
          !existingPool ||
          existingPool.pool_fee_bps === null ||
          pool.pool_fee_bps > existingPool.pool_fee_bps
        ) {
          poolsByPair.set(pairKey, pool);
        }
      });

      const pools: BotegaPool[] = Array.from(poolsByPair.values()).map(
        (pool) => ({
          poolId: pool.amm_process,
          tokenA: pool.token0,
          tokenB: pool.token1,
        }),
      );

      this.logger.log(
        `Loaded ${pools.length} Botega pools from hardcoded data`,
      );
      return pools;
    } catch (error) {
      this.logger.error('Error fetching Botega pools:', error);
      return [];
    }
  }

  private async fetchPermaswapPools(): Promise<PermaswapPool[]> {
    try {
      const result = await dryrun({
        process: '5G5_ftQT6f2OsmJ8EZ4-84eRcIMNEmUyH9aQSD85f9I',
        tags: [
          {
            name: 'Action',
            value: 'GetAllPools',
          },
        ],
      });

      const poolsData = (result as DryrunResult).Messages[0]?.Data;
      if (!poolsData) return [];

      const pools: PermaswapPool[] = [];

      Object.values(JSON.parse(poolsData)).forEach(
        (pool: { X: string; Y: string; Process: string; Fee: string }) => {
          if (pool.X && pool.Y && pool.Process && pool.Fee) {
            pools.push({
              process: pool.Process,
              x: pool.X,
              y: pool.Y,
              fee: pool.Fee,
            });
          }
        },
      );

      return pools;
    } catch (error) {
      this.logger.error('Error fetching Permaswap pools:', error);
      return [];
    }
  }

  invalidateCache(): void {
    this.botegaPoolsCache = [];
    this.permaswapPoolsCache = [];
    this.lastPoolsFetch = 0;
    this.logger.log('Pool cache invalidated');
  }

  getCacheStatus(): CacheStatus {
    const now = Date.now();
    return {
      lastFetch: this.lastPoolsFetch,
      cacheAge: now - this.lastPoolsFetch,
      hasData:
        this.botegaPoolsCache.length > 0 || this.permaswapPoolsCache.length > 0,
    };
  }
}
