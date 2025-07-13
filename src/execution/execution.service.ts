import { Injectable, Logger } from '@nestjs/common';
import { message, result } from '@permaweb/aoconnect';
import { OrdersService } from '../orders/orders.service';
import type {
  Token,
  RouteWithEstimate,
  DryrunResult,
  NoteStatus,
} from '../shared/types';
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
    'cEZfKpbSfHYrmaOFGzn7CvHgWdHueZEn9DHq-aLpCms';

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

        const orderStatusData = await this.waitForOrdersToBeReady(
          orderIds,
          route.pools.map((pool) => pool.poolId),
        );

        console.log('Order status data:', orderStatusData);

        const settleAddress = orderStatusData[0].Settle;
        const noteIds = orderStatusData.map((status) => status.NoteID);

        messageId = await this.executePermaswapTransfer(
          fromToken,
          amount,
          noteIds,
          settleAddress,
        );
      } else {
        throw new Error(`Unsupported DEX`);
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

  private async waitForOrdersToBeReady(
    orderIds: string[],
    poolIds: string[],
    maxRetries: number = 20,
    retryInterval: number = 2000,
  ): Promise<NoteStatus[]> {
    this.logger.log(`Waiting for ${orderIds.length} orders to be ready...`);
    const statusData: NoteStatus[] = [];

    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i];
      const poolId = poolIds[i];
      let retries = 0;
      let orderReady = false;

      while (retries < maxRetries && !orderReady) {
        try {
          this.logger.log(
            `Checking status of order ${orderId} (attempt ${retries + 1}/${maxRetries})`,
          );

          const statusResult = (await this.ordersService.getOrderStatus(
            orderId,
            poolId,
          )) as DryrunResult;

          if (statusResult?.Messages?.[0]?.Data) {
            try {
              console.log(statusResult.Messages[0].Data);
              const statusDataItem = JSON.parse(
                statusResult.Messages[0].Data,
              ) as NoteStatus;
              console.log(statusDataItem);

              if (statusDataItem.Status === 'Open') {
                this.logger.log(`Order ${orderId} is ready (Status: Open)`);
                statusData.push(statusDataItem);
                orderReady = true;
              } else {
                this.logger.log(
                  `Order ${orderId} not ready yet (Status: ${statusDataItem.Status})`,
                );
              }
            } catch (parseError) {
              this.logger.warn(
                `Could not parse status for order ${orderId}:`,
                parseError,
              );
            }
          } else {
            this.logger.log(`No status data yet for order ${orderId}`);
          }

          if (!orderReady) {
            retries++;
            if (retries < maxRetries) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryInterval),
              );
            }
          }
        } catch (error) {
          this.logger.warn(
            `Error checking status for order ${orderId}:`,
            error,
          );
          retries++;
          if (retries < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryInterval));
          }
        }
      }

      if (!orderReady) {
        throw new Error(
          `Order ${orderId} did not become ready within ${maxRetries} attempts`,
        );
      }
    }

    this.logger.log('All orders are ready for execution');
    return statusData;
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
