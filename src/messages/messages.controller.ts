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
import { MessagesService } from './messages.service';
import {
  SwapMessageDto,
  TransferMessageDto,
  SwapMessageResponseDto,
  TransferMessageResponseDto,
} from './dto/messages.dto';

@ApiTags('Messages')
@Controller('messages')
@UsePipes(new ValidationPipe({ transform: true }))
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('swap')
  @ApiOperation({
    summary: 'Prepare swap message',
    description:
      'Prepares an unsigned AO message for swap transaction that user can sign and send',
  })
  @ApiResponse({
    status: 201,
    description: 'Swap message prepared successfully',
    type: SwapMessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to prepare swap message',
  })
  async prepareSwapMessage(
    @Body() dto: SwapMessageDto,
  ): Promise<SwapMessageResponseDto> {
    try {
      const result = await this.messagesService.prepareSwapMessage({
        route: dto.route,
        fromToken: dto.fromToken,
        toToken: dto.toToken,
        amount: dto.amount,
        minAmount: dto.minAmount,
        userAddress: dto.userAddress,
      });

      return {
        unsignedMessage: result.unsignedMessage,
        route: result.route,
        fromToken: result.fromToken,
        toToken: result.toToken,
        amount: result.amount,
        minAmount: result.minAmount,
        userAddress: result.userAddress,
        timestamp: result.timestamp,
        status: result.status,
        orderIds: result.orderIds,
        orderStatusData: result.orderStatusData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to prepare swap message',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Prepare transfer message',
    description:
      'Prepares an unsigned AO message for token transfer that user can sign and send',
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer message prepared successfully',
    type: TransferMessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to prepare transfer message',
  })
  prepareTransferMessage(
    @Body() dto: TransferMessageDto,
  ): TransferMessageResponseDto {
    try {
      const unsignedMessage = this.messagesService.prepareTransferMessage({
        fromToken: dto.fromToken,
        amount: dto.amount,
        noteIds: dto.noteIds,
        noteSettle: dto.noteSettle,
      });

      return {
        unsignedMessage,
        fromToken: dto.fromToken,
        amount: dto.amount,
        noteIds: dto.noteIds,
        noteSettle: dto.noteSettle,
        timestamp: Date.now(),
        status: 'unsigned',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        {
          message: 'Failed to prepare transfer message',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
