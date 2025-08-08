import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RouteWithEstimate } from '../../shared/types';

export class CreateOrderDto {
  @ApiProperty({ description: 'Pool process ID for the order' })
  @IsString()
  poolId: string;

  @ApiProperty({ description: 'Source token process ID' })
  @IsString()
  fromTokenId: string;

  @ApiProperty({ description: 'Destination token process ID' })
  @IsString()
  toTokenId: string;

  @ApiProperty({
    description: 'Raw amount to swap (no denomination conversion)',
    example: '1000000000000',
  })
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Raw minimum amount to receive',
    example: '950000000000',
  })
  @IsString()
  minAmount: string;

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

  @ApiProperty({ description: 'Source token process ID' })
  @IsString()
  fromTokenId: string;

  @ApiProperty({ description: 'Destination token process ID' })
  @IsString()
  toTokenId: string;

  @ApiProperty({ description: 'Raw amount to swap', example: 1000000000000 })
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Raw minimum amount to receive',
    example: '950000000000',
  })
  @IsString()
  minAmount: string;
}

export class OrderResponseDto {
  @ApiProperty({ description: 'Message ID of the created order' })
  messageId: string;

  @ApiProperty({ description: 'Pool process ID used for the order' })
  poolId: string;

  @ApiProperty({ description: 'Source token process ID' })
  fromTokenId: string;

  @ApiProperty({ description: 'Destination token process ID' })
  toTokenId: string;

  @ApiProperty({ description: 'Raw amount being swapped' })
  amount: string;

  @ApiProperty({ description: 'Raw minimum amount to receive' })
  minAmount: string;

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
