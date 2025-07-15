import { Injectable, Logger } from '@nestjs/common';
import { message, dryrun } from '@permaweb/aoconnect';
import type { RouteWithEstimate } from '../shared/types';
import { WalletService } from '../shared/wallet.service';

export interface OrderRequest {
  poolId: string;
  fromTokenId: string;
  toTokenId: string;
  amount: number;
  minAmount: number;
  settleAddress?: string;
}

export interface OrderResponse {
  messageId: string;
  poolId: string;
  fromTokenId: string;
  toTokenId: string;
  amount: number;
  minAmount: number;
  timestamp: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly walletService: WalletService) {}

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
          {
            name: 'AmountIn',
            value: Math.floor(amount).toString(),
          },
          {
            name: 'AmountOut',
            value: Math.floor(minAmount).toString(),
          },
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
    amount: number,
    minAmount: number,
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
          minAmount: minAmount * 0.995,
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
          minAmount: Number(route.intermediateOutput) * 0.98,
          settleAddress: 'IAcoo9WrT3CF-rhAxoYd0OFrzAgCLz3kWETQ4QdDLpw',
        });
        orders.push(firstOrder);

        const secondOrder = await this.createPermaswapOrder({
          poolId: route.pools[1].poolId,
          fromTokenId: route.intermediateTokenId,
          toTokenId,
          amount: route.intermediateOutput * 0.95,
          minAmount: minAmount * 0.95,
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
