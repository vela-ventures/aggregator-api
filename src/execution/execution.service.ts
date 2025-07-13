import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import type {
  Token,
  RouteWithEstimate,
  DryrunResult,
  NoteStatus,
} from '../shared/types';
import { convertToDenomination } from '../shared/types';

export interface SwapExecutionRequest {
  route: RouteWithEstimate;
  fromToken: Token;
  toToken: Token;
  amount: number;
  minAmount: number;
  userAddress: string;
}

export interface UnsignedMessage {
  process: string;
  tags: Array<{ name: string; value: string }>;
  data?: string;
}

export interface SwapExecutionResponse {
  unsignedMessage: UnsignedMessage;
  route: RouteWithEstimate;
  fromToken: Token;
  toToken: Token;
  amount: number;
  minAmount: number;
  userAddress: string;
  timestamp: number;
  status: 'unsigned' | 'ready_to_sign';
  orderIds?: string[];
  orderStatusData?: NoteStatus[];
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

  constructor(private readonly ordersService: OrdersService) {}

  async executeSwap(
    request: SwapExecutionRequest,
  ): Promise<SwapExecutionResponse> {
    const { route, fromToken, toToken, amount, minAmount, userAddress } =
      request;

    try {
      let unsignedMessage: UnsignedMessage;
      let orderIds: string[] = [];
      let orderStatusData: NoteStatus[] = [];

      if (route.dex === 'botega') {
        if (route.hops === 1) {
          unsignedMessage = this.executeBotegaSingleHop(
            route,
            fromToken,
            toToken,
            amount,
            minAmount,
            userAddress,
          );
        } else {
          unsignedMessage = this.executeBotegaMultiHop(
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

        orderStatusData = await this.waitForOrdersToBeReady(
          orderIds,
          route.pools.map((pool) => pool.poolId),
        );

        const settleAddress = orderStatusData[0].Settle;
        const noteIds = orderStatusData.map((status) => status.NoteID);

        unsignedMessage = this.executePermaswapTransfer(
          fromToken,
          amount,
          noteIds,
          settleAddress,
        );
      } else {
        throw new Error(`Unsupported DEX`);
      }

      return {
        unsignedMessage,
        route,
        fromToken,
        toToken,
        amount,
        minAmount,
        userAddress,
        timestamp: Date.now(),
        status: 'unsigned',
        orderIds: orderIds.length > 0 ? orderIds : undefined,
        orderStatusData: orderIds.length > 0 ? orderStatusData : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to execute swap:', error);
      throw error;
    }
  }

  private executeBotegaSingleHop(
    route: RouteWithEstimate,
    fromToken: Token,
    toToken: Token,
    amount: number,
    minAmount: number,
    userAddress: string,
  ): UnsignedMessage {
    const unsignedMessage: UnsignedMessage = {
      process: fromToken.processId,
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
    };

    this.logger.log(
      `Prepared Botega single-hop swap message for process: ${fromToken.processId}`,
    );
    return unsignedMessage;
  }

  private executeBotegaMultiHop(
    route: RouteWithEstimate,
    fromToken: Token,
    toToken: Token,
    amount: number,
    minAmount: number,
    userAddress: string,
  ): UnsignedMessage {
    if (!route.intermediateOutput || !route.intermediateToken?.denomination) {
      throw new Error('No intermediate token data for multi-hop swap');
    }

    const unsignedMessage: UnsignedMessage = {
      process: fromToken.processId,
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
    };

    this.logger.log(
      `Prepared Botega multi-hop swap message for process: ${fromToken.processId}`,
    );
    return unsignedMessage;
  }

  private executePermaswapTransfer(
    fromToken: Token,
    amount: number,
    noteIds: string[],
    noteSettle: string,
  ): UnsignedMessage {
    const currentTimestamp = Date.now();

    const unsignedMessage: UnsignedMessage = {
      process: fromToken.processId,
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
    };

    this.logger.log(
      `Prepared Permaswap transfer message for process: ${fromToken.processId}`,
    );
    return unsignedMessage;
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
              const statusDataItem = JSON.parse(
                statusResult.Messages[0].Data,
              ) as NoteStatus;

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

  executeTransfer(request: TransferRequest): UnsignedMessage {
    const { fromToken, amount, noteIds, noteSettle } = request;

    try {
      return this.executePermaswapTransfer(
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
