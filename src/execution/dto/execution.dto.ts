import { IsString, IsNumber, IsArray, IsPositive, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Token, RouteWithEstimate } from '../../shared/types';

export class SwapExecutionDto {
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

  @ApiProperty({ description: 'Signer for the transaction' })
  signer: any;
}

export class TransferDto {
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

  @ApiProperty({ description: 'Signer for the transaction' })
  signer: any;
}

export class SwapExecutionResponseDto {
  @ApiProperty({ description: 'Message ID of the swap transaction' })
  messageId: string;

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

  @ApiProperty({ description: 'Transaction timestamp' })
  timestamp: number;

  @ApiProperty({ description: 'Transaction status' })
  status: 'submitted' | 'pending' | 'completed' | 'failed';

  @ApiPropertyOptional({ description: 'Order IDs for Permaswap routes', type: [String] })
  orderIds?: string[];
}

export class TransferResponseDto {
  @ApiProperty({ description: 'Message ID of the transfer transaction' })
  messageId: string;

  @ApiProperty({ description: 'Source token details' })
  fromToken: Token;

  @ApiProperty({ description: 'Amount transferred' })
  amount: number;

  @ApiProperty({ description: 'Note IDs used for the transfer', type: [String] })
  noteIds: string[];

  @ApiProperty({ description: 'Note settle address' })
  noteSettle: string;

  @ApiProperty({ description: 'Transfer timestamp' })
  timestamp: number;

  @ApiProperty({ description: 'Transfer status' })
  status: 'submitted' | 'pending' | 'completed' | 'failed';
} 