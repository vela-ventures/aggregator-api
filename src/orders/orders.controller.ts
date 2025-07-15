import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  CreateMultipleOrdersDto,
  OrderResponseDto,
  OrderStatusDto,
} from './dto/orders.dto';

@ApiTags('Orders')
@Controller('orders')
@UsePipes(new ValidationPipe({ transform: true }))
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create single Permaswap order',
    description: 'Creates a single order for Permaswap DEX',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({ description: 'Failed to create order' })
  async createOrder(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    try {
      const order = await this.ordersService.createPermaswapOrder({
        poolId: dto.poolId,
        fromTokenId: dto.fromTokenId,
        toTokenId: dto.toTokenId,
        amount: dto.amount,
        minAmount: dto.minAmount,
        settleAddress: dto.settleAddress,
      });

      return {
        messageId: order.messageId,
        poolId: order.poolId,
        fromTokenId: order.fromTokenId,
        toTokenId: order.toTokenId,
        amount: order.amount,
        minAmount: order.minAmount,
        timestamp: order.timestamp,
        status: 'created',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to create order',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('multiple')
  @ApiOperation({
    summary: 'Create multiple Permaswap orders',
    description: 'Creates multiple orders for multi-hop Permaswap routes',
  })
  @ApiResponse({
    status: 201,
    description: 'Orders created successfully',
    type: [OrderResponseDto],
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({ description: 'Failed to create orders' })
  async createMultipleOrders(
    @Body() dto: CreateMultipleOrdersDto,
  ): Promise<OrderResponseDto[]> {
    try {
      const orders = await this.ordersService.createMultiplePermaswapOrders(
        dto.route,
        dto.fromTokenId,
        dto.toTokenId,
        dto.amount,
        dto.minAmount,
      );

      return orders.map((order) => ({
        messageId: order.messageId,
        poolId: order.poolId,
        fromTokenId: order.fromTokenId,
        toTokenId: order.toTokenId,
        amount: order.amount,
        minAmount: order.minAmount,
        timestamp: order.timestamp,
        status: 'created',
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to create multiple orders',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':messageId/status')
  @ApiOperation({
    summary: 'Get order status',
    description: 'Retrieves the status of a specific order',
  })
  @ApiResponse({
    status: 200,
    description: 'Order status retrieved successfully',
    type: OrderStatusDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid message ID' })
  @ApiInternalServerErrorResponse({ description: 'Failed to get order status' })
  async getOrderStatus(
    @Param('messageId') messageId: string,
    @Query('processId') processId: string,
  ): Promise<OrderStatusDto> {
    try {
      const status = await this.ordersService.getOrderStatus(
        messageId,
        processId,
      );

      return {
        messageId,
        processId,
        status: status.Messages?.[0]?.Data || 'pending',
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to get order status',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
