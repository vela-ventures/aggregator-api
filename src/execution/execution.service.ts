import { Injectable, Logger } from '@nestjs/common';
import { message, result } from '@permaweb/aoconnect';
import { OrdersService } from '../orders/orders.service';
import type { Token, RouteWithEstimate } from '../shared/types';
import { convertToDenomination } from '../shared/types';
import { WalletService } from 'src/shared/wallet.service';

export interface SwapExecutionRequest {
  route: RouteWithEstimate;
  fromToken: Token;
  toToken: Token;
  amount: number;
  minAmount: number;
  userAddress: string;
}

export interface SwapExecutionResponse {
  messageId: string;
  route: RouteWithEstimate;
  fromToken: Token;
  toToken: Token;
  amount: number;
  minAmount: number;
  userAddress: string;
  timestamp: number;
  status: 'submitted' | 'pending' | 'completed' | 'failed';
  orderIds?: string[];
}

export interface TransferRequest {
  fromToken: Token;
  amount: number;
  noteIds: string[];
  noteSettle: string;
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly DEMO_AGGREGATOR_ID =
    'IAcoo9WrT3CF-rhAxoYd0OFrzAgCLz3kWETQ4QdDLpw';

  constructor(
    private readonly ordersService: OrdersService,
    private readonly walletService: WalletService,
  ) {}

  async executeSwap(
    request: SwapExecutionRequest,
  ): Promise<SwapExecutionResponse> {
    const { route, fromToken, toToken, amount, minAmount, userAddress } =
      request;

    try {
      let messageId: string;
      let orderIds: string[] = [];

      if (route.dex === 'botega') {
        if (route.hops === 1) {
          messageId = await this.executeBotegaSingleHop(
            route,
            fromToken,
            toToken,
            amount,
            minAmount,
            userAddress,
          );
        } else {
          messageId = await this.executeBotegaMultiHop(
            route,
            fromToken,
            toToken,
            amount,
            minAmount,
            userAddress,
          );
        }
      } else if (route.dex === 'permaswap') {
        const orders = await this.ordersService.createMultiplePermaswapOrders(
          route,
          fromToken,
          toToken,
          amount,
          minAmount,
        );
        orderIds = orders.map((order) => order.messageId);
        messageId = await this.executePermaswapTransfer(
          fromToken,
          amount,
          orderIds,
          this.DEMO_AGGREGATOR_ID,
        );
      } else {
        throw new Error(`Unsupported DEX: ${route.dex}`);
      }

      return {
        messageId,
        route,
        fromToken,
        toToken,
        amount,
        minAmount,
        userAddress,
        timestamp: Date.now(),
        status: 'submitted',
        orderIds: orderIds.length > 0 ? orderIds : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to execute swap:', error);
      throw error;
    }
  }

  private async executeBotegaSingleHop(
    route: RouteWithEstimate,
    fromToken: Token,
    toToken: Token,
    amount: number,
    minAmount: number,
    userAddress: string,
  ): Promise<string> {
    const messageId = await message({
      process: fromToken.processId,
      signer: this.walletService.getSigner(),
      tags: [
        {
          name: 'Action',
          value: 'Transfer',
        },
        {
          name: 'Recipient',
          value: this.DEMO_AGGREGATOR_ID,
        },
        {
          name: 'X-Botega-Pool-Id',
          value: route.pools[0].poolId,
        },
        {
          name: 'Quantity',
          value: convertToDenomination(amount, fromToken.denomination),
        },
        {
          name: 'X-Action',
          value: 'Swap',
        },
        {
          name: 'X-Expected-Min-Output',
          value: convertToDenomination(minAmount, toToken.denomination),
        },
        {
          name: 'X-Swap-Data-Agr',
          value: 'SwapRequest',
        },
        {
          name: 'X-Initial-Agr-Sender',
          value: userAddress,
        },
      ],
    });

    await result({
      message: messageId,
      process: fromToken.processId,
    });

    this.logger.log(`Executed Botega single-hop swap: ${messageId}`);
    return messageId;
  }

  private async executeBotegaMultiHop(
    route: RouteWithEstimate,
    fromToken: Token,
    toToken: Token,
    amount: number,
    minAmount: number,
    userAddress: string,
  ): Promise<string> {
    if (!route.intermediateOutput || !route.intermediateToken?.denomination) {
      throw new Error('No intermediate token data for multi-hop swap');
    }

    const messageId = await message({
      process: fromToken.processId,
      signer: this.walletService.getSigner(),
      tags: [
        {
          name: 'Action',
          value: 'Transfer',
        },
        {
          name: 'Recipient',
          value: this.DEMO_AGGREGATOR_ID,
        },
        {
          name: 'Quantity',
          value: convertToDenomination(amount, fromToken.denomination),
        },
        {
          name: 'X-Action',
          value: 'Multi-Hop-Swap',
        },
        {
          name: 'X-Route-Data',
          value: JSON.stringify({
            dex: route.dex,
            pools: route.pools,
            hops: route.hops,
            intermediateTokenId: route.intermediateToken?.processId,
            intermediateOutput: convertToDenomination(
              route.intermediateOutput,
              route.intermediateToken?.denomination,
            ),
            finalToken: toToken.processId,
          }),
        },
        {
          name: 'X-Expected-Min-Output',
          value: convertToDenomination(minAmount, toToken.denomination),
        },
        {
          name: 'X-Swap-Data-Agr',
          value: 'SwapRequest',
        },
        {
          name: 'X-Initial-Agr-Sender',
          value: userAddress,
        },
      ],
    });

    await result({
      message: messageId,
      process: fromToken.processId,
    });

    this.logger.log(`Executed Botega multi-hop swap: ${messageId}`);
    return messageId;
  }

  private async executePermaswapTransfer(
    fromToken: Token,
    amount: number,
    noteIds: string[],
    noteSettle: string,
  ): Promise<string> {
    const currentTimestamp = Date.now();

    const messageId = await message({
      process: fromToken.processId,
      signer: this.walletService.getSigner(),
      tags: [
        {
          name: 'Action',
          value: 'Transfer',
        },
        {
          name: 'Timestamp',
          value: currentTimestamp.toString(),
        },
        {
          value: convertToDenomination(amount, fromToken.denomination),
          name: 'Quantity',
        },
        {
          value: JSON.stringify(noteIds),
          name: 'X-Ffp-Note-Ids',
        },
        {
          value: 'Settle',
          name: 'X-FFP-For',
        },
        {
          value: noteSettle,
          name: 'X-Note-Settler',
        },
        {
          value: this.DEMO_AGGREGATOR_ID,
          name: 'Recipient',
        },
        {
          value: 'Permaswap',
          name: 'X-Swap-Data-Agr',
        },
      ],
    });

    this.logger.log(`Executed Permaswap transfer: ${messageId}`);
    return messageId;
  }

  async executeTransfer(request: TransferRequest): Promise<string> {
    const { fromToken, amount, noteIds, noteSettle } = request;

    try {
      return await this.executePermaswapTransfer(
        fromToken,
        amount,
        noteIds,
        noteSettle,
      );
    } catch (error) {
      this.logger.error('Failed to execute transfer:', error);
      throw error;
    }
  }
}
