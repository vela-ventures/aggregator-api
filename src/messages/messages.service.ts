import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import type {
  RouteWithEstimate,
  DryrunResult,
  NoteStatus,
} from '../shared/types';

export interface SwapMessageRequest {
  route: RouteWithEstimate;
  fromTokenId: string;
  toTokenId: string;
  amount: number;
  minAmount: number;
  userAddress: string;
}

export interface UnsignedMessage {
  process: string;
  tags: Array<{ name: string; value: string }>;
  data?: string;
}

export interface SwapMessageResponse {
  unsignedMessage: UnsignedMessage;
  route: RouteWithEstimate;
  fromTokenId: string;
  toTokenId: string;
  amount: number;
  minAmount: number;
  userAddress: string;
  timestamp: number;
  status: 'unsigned' | 'ready_to_sign';
  orderIds?: string[];
  orderStatusData?: NoteStatus[];
}

export interface TransferMessageRequest {
  fromTokenId: string;
  amount: number;
  noteIds: string[];
  noteSettle: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly DEMO_AGGREGATOR_ID =
    'cEZfKpbSfHYrmaOFGzn7CvHgWdHueZEn9DHq-aLpCms';

  constructor(private readonly ordersService: OrdersService) {}

  async prepareSwapMessage(
    request: SwapMessageRequest,
  ): Promise<SwapMessageResponse> {
    const { route, fromTokenId, toTokenId, amount, minAmount, userAddress } =
      request;

    try {
      let unsignedMessage: UnsignedMessage;
      let orderIds: string[] = [];
      let orderStatusData: NoteStatus[] = [];

      if (route.dex === 'botega') {
        if (route.hops === 1) {
          unsignedMessage = this.prepareBotegaSingleHopMessage(
            route,
            fromTokenId,
            amount,
            minAmount,
            userAddress,
          );
        } else {
          unsignedMessage = this.prepareBotegaMultiHopMessage(
            route,
            fromTokenId,
            toTokenId,
            amount,
            minAmount,
            userAddress,
          );
        }
      } else if (route.dex === 'permaswap') {
        const orders = await this.ordersService.createMultiplePermaswapOrders(
          route,
          fromTokenId,
          toTokenId,
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

        unsignedMessage = this.preparePermaswapTransferMessage(
          fromTokenId,
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
        fromTokenId,
        toTokenId,
        amount,
        minAmount,
        userAddress,
        timestamp: Date.now(),
        status: 'unsigned',
        orderIds: orderIds.length > 0 ? orderIds : undefined,
        orderStatusData: orderIds.length > 0 ? orderStatusData : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to prepare swap message:', error);
      throw error;
    }
  }

  private prepareBotegaSingleHopMessage(
    route: RouteWithEstimate,
    fromTokenId: string,
    amount: number,
    minAmount: number,
    userAddress: string,
  ): UnsignedMessage {
    const unsignedMessage: UnsignedMessage = {
      process: fromTokenId,
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
          value: Math.floor(amount).toString(),
        },
        {
          name: 'X-Action',
          value: 'Swap',
        },
        {
          name: 'X-Expected-Min-Output',
          value: Math.floor(minAmount).toString(),
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
      `Prepared Botega single-hop swap message for process: ${fromTokenId}`,
    );
    return unsignedMessage;
  }

  private prepareBotegaMultiHopMessage(
    route: RouteWithEstimate,
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    minAmount: number,
    userAddress: string,
  ): UnsignedMessage {
    if (!route.intermediateOutput) {
      throw new Error('No intermediate token data for multi-hop swap');
    }

    const unsignedMessage: UnsignedMessage = {
      process: fromTokenId,
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
          value: Math.floor(amount).toString(),
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
            intermediateTokenId: route.intermediateTokenId,
            intermediateOutput: Math.floor(route.intermediateOutput).toString(),
            finalToken: toTokenId,
          }),
        },
        {
          name: 'X-Expected-Min-Output',
          value: Math.floor(minAmount).toString(),
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
      `Prepared Botega multi-hop swap message for process: ${fromTokenId}`,
    );
    return unsignedMessage;
  }

  private preparePermaswapTransferMessage(
    fromTokenId: string,
    amount: number,
    noteIds: string[],
    noteSettle: string,
  ): UnsignedMessage {
    const currentTimestamp = Date.now();

    const unsignedMessage: UnsignedMessage = {
      process: fromTokenId,
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
          value: Math.floor(amount).toString(),
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
      `Prepared Permaswap transfer message for process: ${fromTokenId}`,
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

    this.logger.log('All orders are ready for message preparation');
    return statusData;
  }

  prepareTransferMessage(request: TransferMessageRequest): UnsignedMessage {
    const { fromTokenId, amount, noteIds, noteSettle } = request;

    try {
      return this.preparePermaswapTransferMessage(
        fromTokenId,
        amount,
        noteIds,
        noteSettle,
      );
    } catch (error) {
      this.logger.error('Failed to prepare transfer message:', error);
      throw error;
    }
  }
}
