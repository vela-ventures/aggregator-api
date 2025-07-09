import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Token, RouteWithEstimate } from '../../shared/types';

export class CreateOrderDto {
  @ApiProperty({ description: 'Pool ID for the order' })
  @IsString()
  poolId: string;

  @ApiProperty({ description: 'Source token details' })
  @ValidateNested()
  @Type(() => Object)
  fromToken: Token;

  @ApiProperty({ description: 'Destination token details' })
  @ValidateNested()
  @Type(() => Object)
  toToken: Token;

  @ApiProperty({ description: 'Amount to swap', example: 1000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Minimum amount to receive', example: 950 })
  @IsNumber()
  @IsPositive()
  minAmount: number;

  @ApiPropertyOptional({ description: 'Settle address for the order' })
  @IsOptional()
  @IsString()
  settleAddress?: string;
}

export class CreateMultipleOrdersDto {
  @ApiProperty({ description: 'Route for multi-hop swap' })
  @ValidateNested()
  @Type(() => Object)
  route: RouteWithEstimate;

  @ApiProperty({ description: 'Source token details' })
  @ValidateNested()
  @Type(() => Object)
  fromToken: Token;

  @ApiProperty({ description: 'Destination token details' })
  @ValidateNested()
  @Type(() => Object)
  toToken: Token;

  @ApiProperty({ description: 'Amount to swap', example: 1000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Minimum amount to receive', example: 950 })
  @IsNumber()
  @IsPositive()
  minAmount: number;
}

export class OrderResponseDto {
  @ApiProperty({ description: 'Message ID of the created order' })
  messageId: string;

  @ApiProperty({ description: 'Pool ID used for the order' })
  poolId: string;

  @ApiProperty({ description: 'Source token details' })
  fromToken: Token;

  @ApiProperty({ description: 'Destination token details' })
  toToken: Token;

  @ApiProperty({ description: 'Amount being swapped' })
  amount: number;

  @ApiProperty({ description: 'Minimum amount to receive' })
  minAmount: number;

  @ApiProperty({ description: 'Order creation timestamp' })
  timestamp: number;

  @ApiProperty({ description: 'Order status' })
  status: string;
}

export class OrderStatusDto {
  @ApiProperty({ description: 'Message ID of the order' })
  messageId: string;

  @ApiProperty({ description: 'Process ID of the order' })
  processId: string;

  @ApiProperty({ description: 'Current status of the order' })
  status: string;

  @ApiProperty({ description: 'Status check timestamp' })
  timestamp: number;
}
