import {
  IsString,
  IsNumber,
  IsArray,
  IsPositive,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Token, RouteWithEstimate, NoteStatus } from '../../shared/types';

export class UnsignedMessageDto {
  @ApiProperty({ description: 'Process ID to send the message to' })
  @IsString()
  process: string;

  @ApiProperty({
    description: 'Message tags',
    type: [Object],
    example: [{ name: 'Action', value: 'Transfer' }],
  })
  @IsArray()
  tags: Array<{ name: string; value: string }>;

  @ApiPropertyOptional({ description: 'Message data (optional)' })
  @IsOptional()
  @IsString()
  data?: string;
}

export class SwapMessageDto {
  @ApiProperty({ description: 'Route for the swap' })
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

  @ApiProperty({ description: 'User wallet address' })
  @IsString()
  userAddress: string;
}

export class TransferMessageDto {
  @ApiProperty({ description: 'Source token details' })
  @ValidateNested()
  @Type(() => Object)
  fromToken: Token;

  @ApiProperty({ description: 'Amount to transfer', example: 1000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Note IDs for the transfer', type: [String] })
  @IsArray()
  @IsString({ each: true })
  noteIds: string[];

  @ApiProperty({ description: 'Note settle address' })
  @IsString()
  noteSettle: string;
}

export class SwapMessageResponseDto {
  @ApiProperty({
    description: 'Unsigned AO message ready for user to sign and send',
  })
  @ValidateNested()
  @Type(() => UnsignedMessageDto)
  unsignedMessage: UnsignedMessageDto;

  @ApiProperty({ description: 'Route used for the swap' })
  route: RouteWithEstimate;

  @ApiProperty({ description: 'Source token details' })
  fromToken: Token;

  @ApiProperty({ description: 'Destination token details' })
  toToken: Token;

  @ApiProperty({ description: 'Amount being swapped' })
  amount: number;

  @ApiProperty({ description: 'Minimum amount to receive' })
  minAmount: number;

  @ApiProperty({ description: 'User wallet address' })
  userAddress: string;

  @ApiProperty({ description: 'Message preparation timestamp' })
  timestamp: number;

  @ApiProperty({ description: 'Message status' })
  status: 'unsigned' | 'ready_to_sign';

  @ApiPropertyOptional({
    description: 'Order IDs for Permaswap routes',
    type: [String],
  })
  orderIds?: string[];

  @ApiPropertyOptional({
    description: 'Order status data for Permaswap routes',
    type: [Object],
  })
  orderStatusData?: NoteStatus[];
}

export class TransferMessageResponseDto {
  @ApiProperty({
    description: 'Unsigned AO message ready for user to sign and send',
  })
  @ValidateNested()
  @Type(() => UnsignedMessageDto)
  unsignedMessage: UnsignedMessageDto;

  @ApiProperty({ description: 'Source token details' })
  fromToken: Token;

  @ApiProperty({ description: 'Amount transferred' })
  amount: number;

  @ApiProperty({
    description: 'Note IDs used for the transfer',
    type: [String],
  })
  noteIds: string[];

  @ApiProperty({ description: 'Note settle address' })
  noteSettle: string;

  @ApiProperty({ description: 'Message preparation timestamp' })
  timestamp: number;

  @ApiProperty({ description: 'Message status' })
  status: 'unsigned' | 'ready_to_sign';
}
