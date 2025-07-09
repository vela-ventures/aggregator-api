import { Injectable, Logger } from '@nestjs/common';
import { message, dryrun } from '@permaweb/aoconnect';
import type { Token, RouteWithEstimate } from '../shared/types';
import { convertToDenomination } from '../shared/types';
import { WalletService } from '../shared/wallet.service';

export interface OrderRequest {
  poolId: string;
  fromToken: Token;
  toToken: Token;
  amount: number;
  minAmount: number;
  settleAddress?: string;
}

export interface OrderResponse {
  messageId: string;
  poolId: string;
  fromToken: Token;
  toToken: Token;
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
    const { poolId, fromToken, toToken, amount, minAmount, settleAddress } =
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
            value: convertToDenomination(amount, fromToken.denomination),
          },
          {
            name: 'AmountOut',
            value: convertToDenomination(minAmount, toToken.denomination),
          },
          {
            name: 'TokenIn',
            value: fromToken.processId,
          },
          {
            name: 'TokenOut',
            value: toToken.processId,
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
        fromToken,
        toToken,
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
    fromToken: Token,
    toToken: Token,
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
          fromToken,
          toToken,
          amount,
          minAmount,
        });
        orders.push(order);
      } else if (
        route.hops === 2 &&
        route.intermediateToken &&
        route.intermediateOutput
      ) {
        const firstOrder = await this.createPermaswapOrder({
          poolId: route.pools[0].poolId,
          fromToken,
          toToken: route.intermediateToken,
          amount,
          minAmount: Number(route.intermediateOutput) * 0.98,
          settleAddress: 'IAcoo9WrT3CF-rhAxoYd0OFrzAgCLz3kWETQ4QdDLpw',
        });
        orders.push(firstOrder);

        const secondOrder = await this.createPermaswapOrder({
          poolId: route.pools[1].poolId,
          fromToken: route.intermediateToken,
          toToken,
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
          {
            name: 'Action',
            value: 'GetOrderStatus',
          },
          {
            name: 'MessageId',
            value: messageId,
          },
        ],
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to get order status for ${messageId}:`, error);
      throw error;
    }
  }
}
