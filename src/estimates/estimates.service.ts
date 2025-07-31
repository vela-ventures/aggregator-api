import { Injectable, Logger } from '@nestjs/common';
import { dryrun } from '@permaweb/aoconnect';
import type { Route } from '../routes/routes.service';
import type { DryrunResult, RouteWithEstimate } from '../shared/types';

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
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    userAddress?: string,
  ): Promise<RouteWithEstimate[]> {
    const estimatePromises = routes.map(async (route) => {
      try {
        if (route.hops === 1) {
          const estimate = await this.calculateSingleHopEstimate(
            fromTokenId,
            toTokenId,
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
        } else if (route.intermediateTokenId) {
          const firstEstimate = await this.calculateSingleHopEstimate(
            fromTokenId,
            route.intermediateTokenId,
            amount,
            userAddress,
            route.pools[0].poolId,
            route.dex,
          );

          const secondEstimate = await this.calculateSingleHopEstimate(
            route.intermediateTokenId,
            toTokenId,
            firstEstimate.out,
            userAddress,
            route.pools[1].poolId,
            route.dex,
          );

          return {
            ...route,
            estimatedOutput: secondEstimate.out,
            estimatedFee:
              route.dex === 'permaswap'
                ? secondEstimate.fee
                : firstEstimate.fee + secondEstimate.fee,
            intermediateOutput: firstEstimate.out,
          };
        }
        return null;
      } catch (error) {
        this.logger.error(`Error calculating estimate for route:`, error);
        return null;
      }
    });

    const routeResults = await Promise.allSettled(estimatePromises);
    const validRoutes = routeResults
      .map((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
        this.logger.warn(`Route ${index} failed or returned null`);
        return null;
      })
      .filter(
        (route): route is RouteWithEstimate =>
          route !== null && route.estimatedOutput > 0,
      );

    return validRoutes.sort((a, b) => b.estimatedOutput - a.estimatedOutput);
  }

  getBestRoute(
    routesWithEstimates: RouteWithEstimate[],
  ): RouteWithEstimate | null {
    if (routesWithEstimates.length === 0) return null;
    return routesWithEstimates[0];
  }

  private async calculateSingleHopEstimate(
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    userAddress: string | undefined,
    poolId: string,
    dex: 'botega' | 'permaswap',
  ): Promise<SwapEstimate> {
    if (dex === 'botega') {
      return this.calculateBotegaSwap(
        fromTokenId,
        toTokenId,
        amount,
        userAddress,
        poolId,
      );
    } else {
      return this.calculatePermaswapSwap(
        fromTokenId,
        toTokenId,
        amount,
        poolId,
      );
    }
  }

  private async calculateBotegaSwap(
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    userAddress: string | undefined,
    poolId: string,
  ): Promise<SwapEstimate> {
    const tags = [
      { name: 'Action', value: 'Get-Swap-Output' },
      { name: 'Token', value: fromTokenId },
      {
        name: 'Swapper',
        value: userAddress || '0000000000000000000000000000000000000000000',
      },
      {
        name: 'Quantity',
        value: amount.toString(), // Use raw amount, no conversion
      },
    ];

    const result = await this.retryDryrun(
      {
        process: poolId,
        tags,
      },
      'Botega',
    );

    const tagArray = (result as DryrunResult).Messages[0]?.Tags || [];
    const responseTags = Object.fromEntries(
      tagArray.map((tag) => [tag.name, tag.value]),
    );

    return {
      fee: Number(responseTags['LP-Fee-Quantity']) || 0,
      out: Number(responseTags['Output']) || 0,
      outWithFee: Number(responseTags['Output']) || 0,
    };
  }

  private async calculatePermaswapSwap(
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    poolId: string,
  ): Promise<SwapEstimate> {
    const result = await this.retryDryrun(
      {
        process: poolId,
        tags: [{ name: 'Action', value: 'Info' }],
      },
      'Permaswap',
    );

    const permaswapOutput = this.estimateSwap(result, amount, toTokenId);

    return {
      fee: permaswapOutput.outputAmount * 0.0005,
      out: permaswapOutput.outputAmount,
      outWithFee: permaswapOutput.outputAmount,
    };
  }

  private async retryDryrun(
    params: { process: string; tags: { name: string; value: string }[] },
    dexName: string,
    maxRetries: number = 3,
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `${dexName} dryrun attempt ${attempt}/${maxRetries} for process ${params.process}`,
        );

        const result = await dryrun(params);
        return result;
      } catch (error) {
        this.logger.error(
          `${dexName} dryrun attempt ${attempt}/${maxRetries} failed:`,
        );

        // Check if it's the HTML response error
        if (
          error instanceof SyntaxError &&
          error.message.includes("Unexpected token '<'")
        ) {
          this.logger.error(
            `AO Gateway returned HTML instead of JSON (likely overloaded/rate-limited)`,
          );

          // Try to get the actual HTML response from the error
          if (error.message.includes('"<html>')) {
            const htmlMatch = error.message.match(/"(<html>.*?)"/);
            if (htmlMatch) {
              this.logger.error(`HTML Response Content: ${htmlMatch[1]}...`);
            }
          }
        } else {
          this.logger.error(`Other error: ${error.message}`);
        }

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error(
            `All ${maxRetries} attempts failed for ${dexName} dryrun`,
          );
          throw error;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        this.logger.debug(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private estimateSwap(
    response: DryrunResult,
    inputAmount: number,
    inputTokenId: string,
  ): { outputAmount: number; exchangeRate: number; fee: number } {
    const tags: Record<string, string> = {};
    response.Messages[0].Tags.forEach(
      (tag: { name: string; value: string }) => {
        tags[tag.name] = tag.value;
      },
    );

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
      // Fixed: inputAmount is already raw, no need to convert again
      const inputRaw = inputAmountAfterFee;
      const k = reserveX * reserveY;
      const newReserveX = reserveX + inputRaw;
      const newReserveY = k / newReserveX;
      const outputRaw = reserveY - newReserveY;
      // Return raw output to match API expectations (no denomination conversion)
      outputAmount = outputRaw;
      exchangeRate = outputAmount / inputAmountAfterFee;
    } else {
      // Fixed: inputAmount is already raw, no need to convert again
      const inputRaw = inputAmountAfterFee;
      const k = reserveX * reserveY;
      const newReserveY = reserveY + inputRaw;
      const newReserveX = k / newReserveY;
      const outputRaw = reserveX - newReserveX;
      // Return raw output to match API expectations (no denomination conversion)
      outputAmount = outputRaw;
      exchangeRate = outputAmount / inputAmountAfterFee;
    }

    return {
      outputAmount: outputAmount * 0.99,
      exchangeRate,
      fee,
    };
  }
}
