import { Injectable, Logger } from '@nestjs/common';
import { dryrun } from '@permaweb/aoconnect';
import type { Route, Token } from '../routes/routes.service';

export interface RouteWithEstimate extends Route {
  estimatedOutput?: number;
  estimatedFee?: number;
  intermediateOutput?: number;
  error?: string;
}

interface SwapEstimate {
  fee: number;
  out: number;
  outWithFee: number;
}

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  async calculateRouteEstimates(
    routes: Route[],
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress?: string,
  ): Promise<RouteWithEstimate[]> {
    const estimatePromises = routes.map(async (route) => {
      try {
        if (route.hops === 1) {
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
        } else if (route.intermediateToken) {
          const firstEstimate = await this.calculateSingleHopEstimate(
            fromToken,
            route.intermediateToken,
            amount,
            userAddress,
            route.pools[0].poolId,
            route.dex,
          );

          const secondEstimate = await this.calculateSingleHopEstimate(
            route.intermediateToken,
            toToken,
            firstEstimate.outWithFee,
            userAddress,
            route.pools[1].poolId,
            route.dex,
          );

          return {
            ...route,
            intermediateOutput: firstEstimate.out,
            estimatedOutput: secondEstimate.out,
            estimatedFee: firstEstimate.fee + secondEstimate.fee,
          };
        } else {
          throw new Error(
            `Unsupported route configuration: ${route.hops} hops`,
          );
        }
      } catch (error) {
        this.logger.error(`Error calculating estimate for route:`, error);
        return {
          ...route,
          estimatedOutput: 0,
          estimatedFee: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const results = await Promise.allSettled(estimatePromises);

    const validRoutes = results
      .map((result) => (result.status === 'fulfilled' ? result.value : null))
      .filter(
        (route) =>
          route !== null && route.estimatedOutput && route.estimatedOutput > 0,
      ) as RouteWithEstimate[];

    return validRoutes.sort(
      (a, b) => (b.estimatedOutput || 0) - (a.estimatedOutput || 0),
    );
  }

  getBestRoute(
    routesWithEstimates: RouteWithEstimate[],
  ): RouteWithEstimate | null {
    if (routesWithEstimates.length === 0) return null;
    return routesWithEstimates[0];
  }

  private async calculateSingleHopEstimate(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress: string | undefined,
    poolId: string,
    dex: 'botega' | 'permaswap',
  ): Promise<SwapEstimate> {
    if (dex === 'botega') {
      return this.calculateBotegaSwap(
        fromToken,
        toToken,
        amount,
        userAddress,
        poolId,
      );
    } else {
      return this.calculatePermaswapSwap(fromToken, toToken, amount, poolId);
    }
  }

  private async calculateBotegaSwap(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress: string | undefined,
    poolId: string,
  ): Promise<SwapEstimate> {
    const tags = [
      { name: 'Action', value: 'Get-Swap-Output' },
      { name: 'Token', value: fromToken.processId },
      {
        name: 'Swapper',
        value: userAddress || '0000000000000000000000000000000000000000000',
      },
      {
        name: 'Quantity',
        value: this.convertToDenomination(amount, fromToken.denomination),
      },
    ];

    const result = await dryrun({
      process: poolId,
      tags,
    });

    const tagArray: { name: string; value: string }[] =
      result.Messages[0]?.Tags;
    const responseTags = Object.fromEntries(
      tagArray.map((tag) => [tag.name, tag.value]),
    );

    return {
      fee: this.convertFromDenomination(
        Number(responseTags['LP-Fee-Quantity']),
        fromToken.denomination,
      ),
      out: this.convertFromDenomination(
        Number(responseTags['Output']),
        toToken.denomination,
      ),
      outWithFee: this.convertFromDenomination(
        Number(responseTags['Output']),
        toToken.denomination,
      ),
    };
  }

  private async calculatePermaswapSwap(
    fromToken: Token,
    toToken: Token,
    amount: number,
    poolId: string,
  ): Promise<SwapEstimate> {
    const result = await dryrun({
      process: poolId,
      tags: [{ name: 'Action', value: 'Info' }],
    });

    const permaswapOutput = this.estimateSwap(
      result,
      amount,
      toToken.processId,
    );

    return {
      fee: permaswapOutput.outputAmount * 0.0005,
      out: permaswapOutput.outputAmount,
      outWithFee: permaswapOutput.outputAmount,
    };
  }

  private estimateSwap(
    response: any,
    inputAmount: number,
    inputTokenId: string,
  ): { outputAmount: number; exchangeRate: number; fee: number } {
    const tags: Record<string, string> = {};
    response.Messages[0].Tags.forEach((tag: any) => {
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

  private convertToDenomination(amount: number, denomination: number): string {
    return Math.floor(amount * Math.pow(10, denomination)).toString();
  }

  private convertFromDenomination(
    amount: number,
    denomination: number,
  ): number {
    return amount / Math.pow(10, denomination);
  }
}
