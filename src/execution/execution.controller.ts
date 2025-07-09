import {
  Controller,
  Post,
  Body,
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
import { ExecutionService } from './execution.service';
import {
  SwapExecutionDto,
  TransferDto,
  SwapExecutionResponseDto,
  TransferResponseDto,
} from './dto/execution.dto';

@ApiTags('Execution')
@Controller('execution')
@UsePipes(new ValidationPipe({ transform: true }))
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('swap')
  @ApiOperation({
    summary: 'Execute swap',
    description: 'Executes a swap transaction for the given route',
  })
  @ApiResponse({
    status: 201,
    description: 'Swap executed successfully',
    type: SwapExecutionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({ description: 'Failed to execute swap' })
  async executeSwap(
    @Body() dto: SwapExecutionDto,
  ): Promise<SwapExecutionResponseDto> {
    try {
      const result = await this.executionService.executeSwap({
        route: dto.route,
        fromToken: dto.fromToken,
        toToken: dto.toToken,
        amount: dto.amount,
        minAmount: dto.minAmount,
        userAddress: dto.userAddress,
        signer: dto.signer,
      });

      return {
        messageId: result.messageId,
        route: result.route,
        fromToken: result.fromToken,
        toToken: result.toToken,
        amount: result.amount,
        minAmount: result.minAmount,
        userAddress: result.userAddress,
        timestamp: result.timestamp,
        status: result.status,
        orderIds: result.orderIds,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to execute swap',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Execute transfer',
    description: 'Executes a token transfer for Permaswap orders',
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer executed successfully',
    type: TransferResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({ description: 'Failed to execute transfer' })
  async executeTransfer(
    @Body() dto: TransferDto,
  ): Promise<TransferResponseDto> {
    try {
      const messageId = await this.executionService.executeTransfer({
        fromToken: dto.fromToken,
        amount: dto.amount,
        noteIds: dto.noteIds,
        noteSettle: dto.noteSettle,
        signer: dto.signer,
      });

      return {
        messageId,
        fromToken: dto.fromToken,
        amount: dto.amount,
        noteIds: dto.noteIds,
        noteSettle: dto.noteSettle,
        timestamp: Date.now(),
        status: 'submitted',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to execute transfer',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
