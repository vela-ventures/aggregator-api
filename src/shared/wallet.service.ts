import { Injectable, Logger } from '@nestjs/common';
import { createSigner } from '@permaweb/aoconnect';
import * as fs from 'fs';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly signer: (...args: unknown[]) => unknown;

  constructor() {
    const walletPath = process.env.PATH_TO_WALLET;

    if (!walletPath) {
      throw new Error('PATH_TO_WALLET environment variable is not set');
    }

    try {
      const wallet = JSON.parse(fs.readFileSync(walletPath, 'utf8')) as string;
      this.signer = createSigner(wallet);
      this.logger.log('Wallet signer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize wallet signer:', error);
      throw error;
    }
  }

  getSigner(): (...args: unknown[]) => unknown {
    return this.signer;
  }
}
