import { Injectable, Logger } from '@nestjs/common';
import { dryrun } from '@permaweb/aoconnect';
import type { Route } from '../routes/routes.service';
import type {
  DryrunResult,
  RouteWithEstimate,
  ReverseSwapEstimate,
  RouteWithReverseEstimate,
} from '../shared/types';

interface SwapEstimate {
  fee: number;
  out: number;
  outWithFee: number;
  feeRaw?: string;
  outRaw?: string;
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
            estimatedOutput:
              estimate.outRaw ?? this.toNonExponentialString(estimate.out),
            estimatedFee:
              estimate.feeRaw ?? this.toNonExponentialString(estimate.fee),
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
            estimatedOutput:
              secondEstimate.outRaw ??
              this.toNonExponentialString(secondEstimate.out),
            estimatedFee:
              secondEstimate.feeRaw ??
              this.toNonExponentialString(secondEstimate.fee),
            intermediateOutput:
              firstEstimate.outRaw ??
              this.toNonExponentialString(firstEstimate.out),
            intermediateEstimatedFee:
              firstEstimate.feeRaw ??
              this.toNonExponentialString(firstEstimate.fee),
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
      .filter((route): route is RouteWithEstimate => {
        if (!route) return false;
        const out = Number(route.estimatedOutput);
        return out > 0;
      });

    const sorted = validRoutes
      .filter((r): r is RouteWithEstimate => !!r)
      .sort((a, b) => Number(b.estimatedOutput) - Number(a.estimatedOutput));
    return sorted;
  }

  async calculateReverseRouteEstimates(
    routes: Route[],
    fromTokenId: string,
    toTokenId: string,
    desiredOutput: number,
    userAddress?: string,
  ): Promise<RouteWithReverseEstimate[]> {
    const estimatePromises = routes.map(async (route) => {
      try {
        if (route.hops === 1) {
          const estimate = await this.calculateReverseEstimate(
            fromTokenId,
            toTokenId,
            desiredOutput,
            route.pools[0].poolId,
            route.dex,
            userAddress,
          );
          return {
            ...route,
            estimatedOutput: Math.floor(desiredOutput).toString(),
            requiredInput: Math.floor(estimate.inputRequired).toString(),
            estimatedFee: Math.floor(estimate.fee).toString(),
            inputWithFee: Math.floor(estimate.inputWithFee).toString(),
          };
        } else if (route.intermediateTokenId) {
          const secondEstimate = await this.calculateReverseEstimate(
            route.intermediateTokenId,
            toTokenId,
            desiredOutput,
            route.pools[1].poolId,
            route.dex,
            userAddress,
          );

          const firstEstimate = await this.calculateReverseEstimate(
            fromTokenId,
            route.intermediateTokenId,
            secondEstimate.inputWithFee,
            route.pools[0].poolId,
            route.dex,
            userAddress,
          );

          return {
            ...route,
            estimatedOutput: Math.floor(desiredOutput).toString(),
            requiredInput: Math.floor(firstEstimate.inputRequired).toString(),
            estimatedFee: Math.floor(firstEstimate.fee + secondEstimate.fee).toString(),
            inputWithFee: Math.floor(firstEstimate.inputWithFee).toString(),
            intermediateInputRequired: Math.floor(secondEstimate.inputRequired).toString(),
            intermediateEstimatedFee: Math.floor(secondEstimate.fee).toString(),
            intermediateOutput: Math.floor(secondEstimate.inputWithFee).toString(),
          };
        }
        return null;
      } catch (error) {
        this.logger.error(
          `Error calculating reverse estimate for route:`,
          error,
        );
        return null;
      }
    });

    const routeResults = await Promise.allSettled(estimatePromises);
    const validRoutes = routeResults
      .map((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
        this.logger.warn(`Reverse route ${index} failed or returned null`);
        return null;
      })
      .filter((route): route is RouteWithReverseEstimate => {
        if (!route) return false;
        return Number(route.requiredInput) > 0;
      });

    // Sort by lowest input required (best deal)
    return validRoutes.sort(
      (a, b) => Number(a.inputWithFee) - Number(b.inputWithFee),
    );
  }

  getBestRoute(
    routesWithEstimates: RouteWithEstimate[],
  ): RouteWithEstimate | null {
    if (routesWithEstimates.length === 0) return null;
    return routesWithEstimates[0];
  }

  getBestReverseRoute(
    routesWithReverseEstimates: RouteWithReverseEstimate[],
  ): RouteWithReverseEstimate | null {
    if (routesWithReverseEstimates.length === 0) return null;
    return routesWithReverseEstimates[0]; // Already sorted by lowest input required
  }

  /**
   * Calculate reverse estimate: how much input token needed to get desired output
   */
  async calculateReverseEstimate(
    fromTokenId: string,
    toTokenId: string,
    desiredOutput: number,
    poolId: string,
    dex: 'botega' | 'permaswap',
    userAddress?: string,
  ): Promise<ReverseSwapEstimate> {
    if (dex === 'botega') {
      return this.calculateBotegaReverseSwap(
        fromTokenId,
        toTokenId,
        desiredOutput,
        poolId,
        userAddress,
      );
    } else {
      return this.calculatePermaswapReverseSwap(
        fromTokenId,
        toTokenId,
        desiredOutput,
        poolId,
      );
    }
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

    const feeRaw = responseTags['LP-Fee-Quantity'] || '0';
    const outRaw = responseTags['Output'] || '0';
    return {
      fee: Number(feeRaw) || 0,
      out: Number(outRaw) || 0,
      outWithFee: Number(outRaw) || 0,
      feeRaw,
      outRaw,
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

    const outRaw = this.toNonExponentialString(permaswapOutput.outputAmount);
    const fee = permaswapOutput.outputAmount * 0.0005;
    const feeRaw = this.toNonExponentialString(fee);
    return {
      fee,
      out: permaswapOutput.outputAmount,
      outWithFee: permaswapOutput.outputAmount,
      feeRaw,
      outRaw,
    };
  }

  private async calculateBotegaReverseSwap(
    fromTokenId: string,
    toTokenId: string,
    desiredOutput: number,
    poolId: string,
    userAddress?: string,
  ): Promise<ReverseSwapEstimate> {
    const [poolInfo, reserves] = await Promise.all([
      this.getBotegaPoolInfo(poolId),
      this.getBotegaReserves(poolId),
    ]);

    const feeBps = Number(poolInfo.FeeBps);
    const feeRate = feeBps / 10000;

    const isFromTokenA = fromTokenId === poolInfo.TokenA;
    const reserveFrom = isFromTokenA
      ? reserves[poolInfo.TokenA]
      : reserves[poolInfo.TokenB];
    const reserveTo = isFromTokenA
      ? reserves[poolInfo.TokenB]
      : reserves[poolInfo.TokenA];

    const k = reserveFrom * reserveTo;

    const newReserveTo = reserveTo - desiredOutput;
    if (newReserveTo <= 0) {
      throw new Error('Desired output exceeds available liquidity');
    }

    const inputBeforeFee = (k / newReserveTo - reserveFrom) * 1.01;

    const inputWithFee = inputBeforeFee / (1 - feeRate);
    const fee = inputWithFee * feeRate;

    return {
      fee,
      inputRequired: inputBeforeFee,
      inputWithFee,
    };
  }

  private async calculatePermaswapReverseSwap(
    fromTokenId: string,
    toTokenId: string,
    desiredOutput: number,
    poolId: string,
  ): Promise<ReverseSwapEstimate> {
    const result = await this.retryDryrun(
      {
        process: poolId,
        tags: [{ name: 'Action', value: 'Info' }],
      },
      'Permaswap',
    );

    return this.estimateReverseSwap(
      result,
      desiredOutput,
      fromTokenId,
      toTokenId,
    );
  }

  private async getBotegaPoolInfo(poolId: string): Promise<any> {
    const result = await this.retryDryrun(
      {
        process: poolId,
        tags: [{ name: 'Action', value: 'Info' }],
      },
      'Botega',
    );

    const tagArray = (result as DryrunResult).Messages[0]?.Tags || [];
    return Object.fromEntries(tagArray.map((tag) => [tag.name, tag.value]));
  }

  private async getBotegaReserves(
    poolId: string,
  ): Promise<Record<string, number>> {
    const result = await this.retryDryrun(
      {
        process: poolId,
        tags: [{ name: 'Action', value: 'Get-Reserves' }],
      },
      'Botega',
    );

    const tagArray = (result as DryrunResult).Messages[0]?.Tags || [];
    const reserves: Record<string, number> = {};

    tagArray.forEach((tag) => {
      if (tag.name.length > 20) {
        reserves[tag.name] = Number(tag.value);
      }
    });

    return reserves;
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

  private estimateReverseSwap(
    response: DryrunResult,
    desiredOutput: number,
    inputTokenId: string,
    outputTokenId: string,
  ): ReverseSwapEstimate {
    const tags: Record<string, string> = {};
    response.Messages[0].Tags.forEach(
      (tag: { name: string; value: string }) => {
        tags[tag.name] = tag.value;
      },
    );

    const reserveX = Number(tags.PX);
    const reserveY = Number(tags.PY);
    const feeRate = Number(tags.Fee) / 100000;
    const tokenYId = tags.Y;

    const isXtoY = inputTokenId === tokenYId;

    let inputRequired: number;

    if (isXtoY) {
      const k = reserveX * reserveY;
      const newReserveX = reserveX - desiredOutput;

      if (newReserveX <= 0) {
        throw new Error('Desired output exceeds available liquidity');
      }

      const inputBeforeFee = k / newReserveX - reserveY;
      inputRequired = inputBeforeFee / (1 - feeRate);
    } else {
      const k = reserveX * reserveY;
      const newReserveY = reserveY - desiredOutput;

      if (newReserveY <= 0) {
        throw new Error('Desired output exceeds available liquidity');
      }

      const inputBeforeFee = k / newReserveY - reserveX;
      inputRequired = inputBeforeFee / (1 - feeRate);
    }

    const fee = inputRequired * feeRate;
    const inputBeforeFee = inputRequired - fee;

    // Add 1% safety margin
    const inputWithSafety = inputRequired * 1.02;

    return {
      fee,
      inputRequired: inputBeforeFee,
      inputWithFee: inputWithSafety,
    };
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

  private toNonExponentialString(value: number): string {
    if (!isFinite(value)) return '0';
    // Convert to a string without exponential notation
    const str = value.toString();
    if (!/e/i.test(str)) return Math.floor(value).toString();
    // Use BigInt via integer rounding to avoid floating exponent formats
    const [mantissa, exponent] = str.toLowerCase().split('e');
    const exp = Number(exponent);
    const [intPart, fracPart = ''] = mantissa.split('.');
    const digits = intPart + fracPart;
    if (exp >= 0) {
      const zeros = exp - fracPart.length;
      return zeros >= 0
        ? (digits + '0'.repeat(zeros)).replace(/^0+/, '') || '0'
        : (intPart + fracPart.slice(0, fracPart.length + exp)).replace(/^0+/, '') || '0';
    } else {
      // Negative exponent: number < 1; floor to 0 in raw integer context
      return '0';
    }
  }
}
