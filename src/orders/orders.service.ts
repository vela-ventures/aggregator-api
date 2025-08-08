import { Injectable, Logger } from '@nestjs/common';
import { message, dryrun } from '@permaweb/aoconnect';
import type { RouteWithEstimate } from '../shared/types';
import { WalletService } from '../shared/wallet.service';

export interface OrderRequest {
  poolId: string;
  fromTokenId: string;
  toTokenId: string;
  amount: string;
  minAmount: string;
  settleAddress?: string;
}

export interface OrderResponse {
  messageId: string;
  poolId: string;
  fromTokenId: string;
  toTokenId: string;
  amount: string;
  minAmount: string;
  timestamp: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly walletService: WalletService) {}

  private mulBps(amount: string, bps: number): string {
    // amount is a raw integer string; bps in [0..10000]
    const a = BigInt(amount);
    const b = BigInt(bps);
    return ((a * b) / BigInt(10000)).toString();
  }

  async createPermaswapOrder(
    orderRequest: OrderRequest,
  ): Promise<OrderResponse> {
    const { poolId, fromTokenId, toTokenId, amount, minAmount, settleAddress } =
      orderRequest;
    const currentTimestamp = Date.now();

    try {
      const messageId = await message({
        process: poolId,
        signer: this.walletService.getSigner(),
        tags: [
          {
            name: 'Action',
            value: 'RequestOrder',
          },
          { name: 'AmountIn', value: amount },
          { name: 'AmountOut', value: minAmount },
          {
            name: 'TokenIn',
            value: fromTokenId,
          },
          {
            name: 'TokenOut',
            value: toTokenId,
          },
          {
            name: 'TimeStamp',
            value: currentTimestamp.toString(),
          },
          ...(settleAddress ? [{ name: 'Settle', value: settleAddress }] : []),
        ],
      });

      this.logger.log(`Created Permaswap order: ${messageId}`);

      return {
        messageId,
        poolId,
        fromTokenId,
        toTokenId,
        amount,
        minAmount,
        timestamp: currentTimestamp,
      };
    } catch (error) {
      this.logger.error('Failed to create Permaswap order:', error);
      throw error;
    }
  }

  async createMultiplePermaswapOrders(
    route: RouteWithEstimate,
    fromTokenId: string,
    toTokenId: string,
    amount: string,
    minAmount: string,
  ): Promise<OrderResponse[]> {
    if (route.dex !== 'permaswap') {
      throw new Error('This function is only for Permaswap routes');
    }

    const orders: OrderResponse[] = [];

    try {
      if (route.hops === 1) {
        const order = await this.createPermaswapOrder({
          poolId: route.pools[0].poolId,
          fromTokenId,
          toTokenId,
          amount,
          minAmount: this.mulBps(minAmount, 9950),
        });
        orders.push(order);
      } else if (
        route.hops === 2 &&
        route.intermediateTokenId &&
        route.intermediateOutput
      ) {
        const firstOrder = await this.createPermaswapOrder({
          poolId: route.pools[0].poolId,
          fromTokenId,
          toTokenId: route.intermediateTokenId,
          amount,
          minAmount: this.mulBps(Math.floor(Number(route.intermediateOutput)).toString(), 9950),
          settleAddress: 'IAcoo9WrT3CF-rhAxoYd0OFrzAgCLz3kWETQ4QdDLpw',
        });
        orders.push(firstOrder);

        const secondOrder = await this.createPermaswapOrder({
          poolId: route.pools[1].poolId,
          fromTokenId: route.intermediateTokenId,
          toTokenId,
          amount: this.mulBps(Math.floor(Number(route.intermediateOutput)).toString(), 9900),
          minAmount: this.mulBps(minAmount, 9900),
          settleAddress: 'IAcoo9WrT3CF-rhAxoYd0OFrzAgCLz3kWETQ4QdDLpw',
        });
        orders.push(secondOrder);
      } else {
        throw new Error(`Unsupported route configuration: ${route.hops} hops`);
      }

      return orders;
    } catch (error) {
      this.logger.error('Failed to create multiple Permaswap orders:', error);
      throw error;
    }
  }

  async getOrderStatus(messageId: string, processId: string): Promise<any> {
    try {
      const result = await dryrun({
        process: processId,
        tags: [
          { name: 'Action', value: 'GetNote' },
          { name: 'MakeTx', value: messageId },
        ],
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to get order status for ${messageId}:`, error);
      throw error;
    }
  }
}
