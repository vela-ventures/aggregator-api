import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

const API_URL = 'http://100.120.104.106:3000';

async function forward(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs?: number },
) {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: init.method,
      headers:
        init.method === 'POST' ? { 'content-type': 'application/json' } : {},
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? 10_000),
    });

    const data = await response
      .json()
      .catch(() => ({}) as Record<string, unknown>);

    if (!response.ok) {
      throw new HttpException(
        (data as any)?.message ||
          (data as any)?.error ||
          `API responded with status ${response.status}`,
        response.status,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    const errorMessage =
      error instanceof Error ? error.message : 'API is not available';
    throw new HttpException(
      { error: errorMessage },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

@Controller('bridge/solana')
export class SolanaController {
  @Get('info')
  async info() {
    return forward('/solana/info', { method: 'GET' });
  }

  @Post('claim/:id')
  async buildClaim(@Param('id') id: string) {
    return forward(`/solana/claim/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
  }

  @Post('claim/:id/confirm')
  async confirmClaim(
    @Param('id') id: string,
    @Body() body: { signature?: string },
  ) {
    return forward(`/solana/claim/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      body,
      timeoutMs: 30_000,
    });
  }
}
