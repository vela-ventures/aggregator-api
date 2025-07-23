import { Injectable, Logger } from '@nestjs/common';
import { createSigner } from '@permaweb/aoconnect';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly signer: (...args: unknown[]) => unknown;

  constructor() {
    const base64PrivateKey = process.env.BASE64_PRIVATE_KEY;

    if (!base64PrivateKey) {
      throw new Error('BASE64_PRIVATE_KEY environment variable is not set');
    }

    try {
      const wallet = JSON.parse(
        Buffer.from(base64PrivateKey, 'base64').toString('utf8'),
      ) as string;
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
