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
  poolStatus?: string;
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
      const result = await dryrun({
        process: 'jnIE2NhtDkuH3kfWeKf0MyvzEZdLdkRlzWtgIplm9Ic',
        tags: [
          {
            name: 'Action',
            value: 'Get-Liquidity-Table',
          },
        ],
      });

      const raw = (result as DryrunResult).Messages?.[0]?.Data;
      if (!raw) {
        this.logger.warn('Botega liquidity table dryrun returned empty data');
        return this.fetchBotegaPoolsFromHardcoded();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        this.logger.warn(
          'Failed to parse Botega liquidity table JSON, using fallback',
        );
        return this.fetchBotegaPoolsFromHardcoded();
      }

      const table: Record<string, any> =
        parsed &&
        typeof parsed === 'object' &&
        parsed.Data &&
        typeof parsed.Data === 'object'
          ? parsed.Data
          : parsed;

      const poolsByPair = new Map<
        string,
        { poolId: string; token0: string; token1: string; updatedAt?: number }
      >();

      Object.entries(table || {}).forEach(([poolId, info]) => {
        const token0 = (info as any)?.Token_0;
        const token1 = (info as any)?.Token_1;
        if (!token0 || !token1) return;

        const tokens = [token0, token1].sort();
        const pairKey = `${tokens[0]}-${tokens[1]}`;
        const existing = poolsByPair.get(pairKey);
        const updatedAt = Number((info as any)?.Updated_At) || 0;
        if (!existing || (existing.updatedAt || 0) < updatedAt) {
          poolsByPair.set(pairKey, { poolId, token0, token1, updatedAt });
        }
      });

      const pools: BotegaPool[] = Array.from(poolsByPair.values()).map((p) => ({
        poolId: p.poolId,
        tokenA: p.token0,
        tokenB: p.token1,
      }));

      this.logger.log(
        `Loaded ${pools.length} Botega pools from dryrun liquidity table`,
      );
      if (pools.length === 0) {
        return this.fetchBotegaPoolsFromHardcoded();
      }
      return pools;
    } catch (error) {
      this.logger.error('Error fetching Botega pools via dryrun:', error);
      return this.fetchBotegaPoolsFromHardcoded();
    }
  }

  private fetchBotegaPoolsFromHardcoded(): BotegaPool[] {
    try {
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
      this.logger.error('Error loading hardcoded Botega pools:', error);
      return [];
    }
  }

  private async fetchPermaswapPools(): Promise<PermaswapPool[]> {
    try {
      const response = await fetch(
        'https://api-ffpscan.permaswap.network/pools',
      );
      if (!response.ok) {
        throw new Error(`Permaswap API returned ${response.status}`);
      }

      const apiPools: Array<{
        process: string;
        x: string;
        y: string;
        fee: string;
        poolStatus?: string;
      }> = await response.json();

      const pools: PermaswapPool[] = apiPools
        .filter((p) => p.process && p.x && p.y && p.fee)
        .map((p) => ({
          process: p.process,
          x: p.x,
          y: p.y,
          fee: p.fee,
          poolStatus: p.poolStatus,
        }));

      return pools;
    } catch (apiError) {
      this.logger.warn(
        `Permaswap API fetch failed, falling back to dryrun: ${String(apiError)}`,
      );

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
      } catch (dryrunError) {
        this.logger.error(
          'Error fetching Permaswap pools via dryrun:',
          dryrunError,
        );
        return [];
      }
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
