import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SwapQuoteRequestDto {
  @ApiProperty({ description: 'Source token process ID' })
  @IsString()
  fromTokenId: string;

  @ApiProperty({ description: 'Destination token process ID' })
  @IsString()
  toTokenId: string;

  @ApiProperty({ description: 'Raw amount to swap (no denomination conversion)', example: 1000000000000 })
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiPropertyOptional({ description: 'User wallet address' })
  @IsOptional()
  @IsString()
  userAddress?: string;
}

export class RoutePoolDto {
  @ApiProperty({ description: 'Pool process ID' })
  poolId: string;

  @ApiProperty({ description: 'Input token process ID' })
  tokenIn: string;

  @ApiProperty({ description: 'Output token process ID' })
  tokenOut: string;

  @ApiPropertyOptional({ description: 'Pool fee' })
  fee?: string;
}

export class RouteDto {
  @ApiProperty({ description: 'DEX name', enum: ['botega', 'permaswap'] })
  dex: 'botega' | 'permaswap';

  @ApiProperty({ description: 'Pools in the route', type: [RoutePoolDto] })
  pools: RoutePoolDto[];

  @ApiProperty({ description: 'Number of hops in route' })
  hops: number;

  @ApiPropertyOptional({ description: 'Raw estimated output amount (no denomination conversion)' })
  estimatedOutput?: number;

  @ApiPropertyOptional({ description: 'Raw intermediate output for multi-hop' })
  intermediateOutput?: number;

  @ApiPropertyOptional({ description: 'Raw estimated fee' })
  estimatedFee?: number;

  @ApiPropertyOptional({ description: 'Intermediate token process ID for multi-hop' })
  intermediateTokenId?: string;
}

export class SwapQuoteResponseDto {
  @ApiProperty({ description: 'Source token process ID' })
  fromTokenId: string;

  @ApiProperty({ description: 'Destination token process ID' })
  toTokenId: string;

  @ApiProperty({ description: 'Raw input amount' })
  inputAmount: number;

  @ApiProperty({ description: 'All available routes', type: [RouteDto] })
  routes: RouteDto[];

  @ApiProperty({
    description: 'Best route (highest output)',
    type: RouteDto,
    nullable: true,
  })
  bestRoute: RouteDto | null;

  @ApiProperty({ description: 'Total routes found before filtering' })
  totalRoutesFound: number;

  @ApiProperty({ description: 'Valid routes with estimates' })
  validRoutesWithEstimates: number;

  @ApiProperty({ description: 'Execution time in milliseconds' })
  executionTime: number;
}

export class QuickQuoteRequestDto {
  @ApiProperty({ description: 'Source token process ID' })
  @IsString()
  fromTokenId: string;

  @ApiProperty({ description: 'Destination token process ID' })
  @IsString()
  toTokenId: string;

  @ApiProperty({ description: 'Raw amount to swap (no denomination conversion)', example: 1000000000000 })
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiPropertyOptional({ description: 'User wallet address' })
  @IsOptional()
  @IsString()
  userAddress?: string;
}

export class QuickQuoteResponseDto {
  @ApiProperty({
    description: 'Best route found',
    type: RouteDto,
    nullable: true,
  })
  bestRoute: RouteDto | null;

  @ApiProperty({ description: 'Raw estimated output amount' })
  estimatedOutput: number;

  @ApiProperty({ description: 'Raw estimated total fee' })
  estimatedFee: number;

  @ApiProperty({ description: 'Execution time in milliseconds' })
  executionTime: number;
}
