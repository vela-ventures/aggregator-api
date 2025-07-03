import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TokenDto {
  @ApiProperty({ description: 'Token process ID' })
  @IsString()
  processId: string;

  @ApiProperty({ description: 'Token denomination (decimal places)' })
  @IsNumber()
  denomination: number;

  @ApiPropertyOptional({ description: 'Token symbol (e.g., USDC)' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ description: 'Token name' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class SwapQuoteRequestDto {
  @ApiProperty({ description: 'Source token details' })
  @ValidateNested()
  @Type(() => TokenDto)
  fromToken: TokenDto;

  @ApiProperty({ description: 'Destination token details' })
  @ValidateNested()
  @Type(() => TokenDto)
  toToken: TokenDto;

  @ApiProperty({ description: 'Amount to swap', example: 1000 })
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
  @ApiProperty({ description: 'Pool ID' })
  poolId: string;

  @ApiProperty({ description: 'Input token ID' })
  tokenIn: string;

  @ApiProperty({ description: 'Output token ID' })
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

  @ApiPropertyOptional({ description: 'Estimated output amount' })
  estimatedOutput?: number;

  @ApiPropertyOptional({ description: 'Intermediate output for multi-hop' })
  intermediateOutput?: number;

  @ApiPropertyOptional({ description: 'Estimated fee' })
  estimatedFee?: number;

  @ApiPropertyOptional({
    description: 'Intermediate token for multi-hop',
    type: TokenDto,
  })
  intermediateToken?: TokenDto;
}

export class SwapQuoteResponseDto {
  @ApiProperty({ description: 'Source token', type: TokenDto })
  fromToken: TokenDto;

  @ApiProperty({ description: 'Destination token', type: TokenDto })
  toToken: TokenDto;

  @ApiProperty({ description: 'Input amount' })
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

  @ApiProperty({ description: 'Amount to swap', example: 1000 })
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

  @ApiProperty({ description: 'Estimated output amount' })
  estimatedOutput: number;

  @ApiProperty({ description: 'Estimated total fee' })
  estimatedFee: number;

  @ApiProperty({ description: 'Execution time in milliseconds' })
  executionTime: number;
}
