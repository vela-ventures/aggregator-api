import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { connect, dryrun } from '@permaweb/aoconnect';
import type { DryrunResult } from '../../shared/types';
import { SlackService } from '../../slack/src';
import { alertTypes, type AlertType } from '../../slack/src/slack.constants';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  error?: string;
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    arioTokenInfo: HealthCheckResult;
    arioTokenBalance: HealthCheckResult;
    aoTokenInfo: HealthCheckResult;
    aoTokenBalance: HealthCheckResult;
  };
  lastChecked: string;
}

const TEST_ADDRESS = 'OxQoZQVQMq4ZkscGkUfLMy1XE0fY6Ljn0Z8EfI4Cn78';

const ARIO_PROCESS_ID = 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE';
const AO_PROCESS_ID = '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc';

const ARIO_CU_URL = 'https://cu.ardrive.io';
const ARIO_MODE = 'legacy';

type CheckType =
  | 'arioTokenInfo'
  | 'arioTokenBalance'
  | 'aoTokenInfo'
  | 'aoTokenBalance';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private consecutiveFailures: Map<CheckType, number> = new Map([
    ['arioTokenInfo', 0],
    ['arioTokenBalance', 0],
    ['aoTokenInfo', 0],
    ['aoTokenBalance', 0],
  ]);
  private checksWithActiveAlerts: Set<CheckType> = new Set();

  constructor(private readonly slackService: SlackService) {}

  private healthStatus: HealthStatus = {
    status: 'unhealthy',
    checks: {
      arioTokenInfo: {
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date().toISOString(),
      },
      arioTokenBalance: {
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date().toISOString(),
      },
      aoTokenInfo: {
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date().toISOString(),
      },
      aoTokenBalance: {
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date().toISOString(),
      },
    },
    lastChecked: new Date().toISOString(),
  };

  @Cron('*/5 * * * *')
  async runHealthChecks() {
    this.logger.log('Running scheduled health checks...');
    const startTime = Date.now();

    try {
      const [arioTokenInfo, arioTokenBalance, aoTokenInfo, aoTokenBalance] =
        await Promise.all([
          this.checkArioTokenInfo(),
          this.checkArioTokenBalance(),
          this.checkAoTokenInfo(),
          this.checkAoTokenBalance(),
        ]);

      this.healthStatus = {
        status:
          arioTokenInfo.status === 'healthy' &&
          arioTokenBalance.status === 'healthy' &&
          aoTokenInfo.status === 'healthy' &&
          aoTokenBalance.status === 'healthy'
            ? 'healthy'
            : 'unhealthy',
        checks: {
          arioTokenInfo,
          arioTokenBalance,
          aoTokenInfo,
          aoTokenBalance,
        },
        lastChecked: new Date().toISOString(),
      };

      await this.handleAlerts({
        arioTokenInfo,
        arioTokenBalance,
        aoTokenInfo,
        aoTokenBalance,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Health checks completed in ${duration}ms. Overall status: ${this.healthStatus.status}`,
      );
    } catch (error) {
      this.logger.error('Error running health checks:', error);
    }
  }

  private async handleAlerts(checks: {
    arioTokenInfo: HealthCheckResult;
    arioTokenBalance: HealthCheckResult;
    aoTokenInfo: HealthCheckResult;
    aoTokenBalance: HealthCheckResult;
  }) {
    const checkMap: Array<{
      type: CheckType;
      result: HealthCheckResult;
      name: string;
    }> = [
      {
        type: 'arioTokenInfo',
        result: checks.arioTokenInfo,
        name: 'ARIO Token Info',
      },
      {
        type: 'arioTokenBalance',
        result: checks.arioTokenBalance,
        name: 'ARIO Token Balance',
      },
      {
        type: 'aoTokenInfo',
        result: checks.aoTokenInfo,
        name: 'AO Token Info',
      },
      {
        type: 'aoTokenBalance',
        result: checks.aoTokenBalance,
        name: 'AO Token Balance',
      },
    ];

    for (const { type, result, name } of checkMap) {
      if (result.status === 'healthy') {
        const previousFailures = this.consecutiveFailures.get(type) || 0;
        if (previousFailures > 0) {
          this.consecutiveFailures.set(type, 0);
          this.logger.log(
            `${name} check recovered after ${previousFailures} failure(s)`,
          );
        }

        if (this.checksWithActiveAlerts.has(type)) {
          this.checksWithActiveAlerts.delete(type);
          await this.sendRecoveryAlert(name, result);
        }
      } else {
        const currentFailures = (this.consecutiveFailures.get(type) || 0) + 1;
        this.consecutiveFailures.set(type, currentFailures);

        if (currentFailures === 3) {
          this.checksWithActiveAlerts.add(type);
          await this.sendFailureAlert(name, result);
        }
      }
    }
  }

  private async sendFailureAlert(checkName: string, result: HealthCheckResult) {
    try {
      const message = this.formatFailureAlert(checkName, result);
      await this.slackService.sendAlert({
        text: message,
        type: alertTypes.ERROR as AlertType,
      });
      this.logger.log(`Slack alert sent for ${checkName} failure`);
    } catch (error) {
      this.logger.error(`Failed to send Slack alert for ${checkName}:`, error);
    }
  }

  private async sendRecoveryAlert(
    checkName: string,
    result: HealthCheckResult,
  ) {
    try {
      const message = this.formatRecoveryAlert(checkName, result);
      await this.slackService.sendAlert({
        text: message,
        type: alertTypes.SUCCESS as AlertType,
      });
      this.logger.log(`Slack recovery alert sent for ${checkName}`);
    } catch (error) {
      this.logger.error(
        `Failed to send Slack recovery alert for ${checkName}:`,
        error,
      );
    }
  }

  private formatFailureAlert(
    checkName: string,
    result: HealthCheckResult,
  ): string {
    const lines = [
      `Bridge Dryrun Check Failed: ${checkName}`,
      result.error ? `Error: ${result.error}` : 'Unknown error',
      `Response Time: ${result.responseTime}ms`,
      `Timestamp: ${result.timestamp}`,
    ];
    return lines.join('\n');
  }

  private formatRecoveryAlert(
    checkName: string,
    result: HealthCheckResult,
  ): string {
    const lines = [
      `Bridge Dryrun Check Recovered: ${checkName}`,
      'Previously failing, now healthy.',
      `Response Time: ${result.responseTime}ms`,
      `Timestamp: ${result.timestamp}`,
    ];
    return lines.join('\n');
  }

  private async retryDryrun(
    params: {
      dryrunFn: (params: {
        process: string;
        tags: { name: string; value: string }[];
      }) => Promise<DryrunResult>;
      process: string;
      tags: { name: string; value: string }[];
    },
    checkName: string,
    maxRetries: number = 3,
  ): Promise<DryrunResult> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `${checkName} dryrun attempt ${attempt}/${maxRetries} for process ${params.process}`,
        );

        const result = await Promise.race([
          params.dryrunFn({
            process: params.process,
            tags: params.tags,
          }),
          new Promise<DryrunResult>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000),
          ),
        ]);

        return result;
      } catch (error) {
        this.logger.debug(
          `${checkName} dryrun attempt ${attempt}/${maxRetries} failed`,
        );

        if (
          error instanceof SyntaxError &&
          error.message.includes("Unexpected token '<'")
        ) {
          this.logger.debug(
            `AO Gateway returned HTML instead of JSON (likely overloaded/rate-limited)`,
          );
        }

        if (attempt === maxRetries) {
          this.logger.debug(
            `All ${maxRetries} attempts failed for ${checkName} dryrun`,
          );
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        this.logger.debug(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Retry loop completed without result');
  }

  async checkArioTokenInfo(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const { dryrun: arioDryrun } = connect({
        CU_URL: ARIO_CU_URL,
        MODE: ARIO_MODE,
      });

      const result = await this.retryDryrun(
        {
          dryrunFn: arioDryrun,
          process: ARIO_PROCESS_ID,
          tags: [{ name: 'Action', value: 'Info' }],
        },
        'ARIO Token Info',
      );

      const responseTime = Date.now() - startTime;

      if (!result.Messages || !result.Messages[0]) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'No messages in response',
          timestamp,
        };
      }

      const tags = result.Messages[0].Tags || [];
      const requiredTags = ['Name', 'Ticker', 'Logo', 'Denomination'];
      const missingTags = requiredTags.filter(
        (tag) => !tags.some((t) => t.name === tag),
      );

      if (missingTags.length > 0) {
        return {
          status: 'unhealthy',
          responseTime,
          error: `Missing required tags: ${missingTags.join(', ')}`,
          timestamp,
        };
      }

      if (responseTime >= 5000) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'Response time exceeded 5 seconds',
          timestamp,
        };
      }

      this.logger.debug(`ARIO Token Info check passed in ${responseTime}ms`);
      return {
        status: 'healthy',
        responseTime,
        timestamp,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`ARIO Token Info check failed: ${errorMessage}`);
      return {
        status: 'unhealthy',
        responseTime,
        error: errorMessage,
        timestamp,
      };
    }
  }

  async checkArioTokenBalance(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const { dryrun: arioDryrun } = connect({
        CU_URL: ARIO_CU_URL,
        MODE: ARIO_MODE,
      });

      const result = await this.retryDryrun(
        {
          dryrunFn: arioDryrun,
          process: ARIO_PROCESS_ID,
          tags: [
            { name: 'Action', value: 'Balance' },
            { name: 'Recipient', value: TEST_ADDRESS },
          ],
        },
        'ARIO Token Balance',
      );

      const responseTime = Date.now() - startTime;

      if (!result.Messages || !result.Messages[0]) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'No messages in response',
          timestamp,
        };
      }

      if (!result.Messages[0].Data) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'No data field in response',
          timestamp,
        };
      }

      if (responseTime >= 5000) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'Response time exceeded 5 seconds',
          timestamp,
        };
      }

      this.logger.debug(`ARIO Token Balance check passed in ${responseTime}ms`);
      return {
        status: 'healthy',
        responseTime,
        timestamp,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`ARIO Token Balance check failed: ${errorMessage}`);
      return {
        status: 'unhealthy',
        responseTime,
        error: errorMessage,
        timestamp,
      };
    }
  }

  async checkAoTokenInfo(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    const { dryrun: aoDryrun } = connect({
      MU_URL: 'https://mu.ao-testnet.xyz',
      CU_URL: 'https://cu.ao-testnet.xyz',
      GATEWAY_URL: 'https://arweave.net',
      MODE: 'legacy',
    });

    try {
      const result = await this.retryDryrun(
        {
          dryrunFn: aoDryrun,
          process: AO_PROCESS_ID,
          tags: [{ name: 'Action', value: 'Info' }],
        },
        'AO Token Info',
      );

      const responseTime = Date.now() - startTime;
      if (!result.Messages || !result.Messages[0]) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'No messages in response',
          timestamp,
        };
      }

      const tags = result.Messages[0].Tags || [];
      console.log('tags', tags);
      const requiredTags = ['Name', 'Ticker', 'Logo', 'Denomination'];
      const missingTags = requiredTags.filter(
        (tag) => !tags.some((t) => t.name === tag),
      );

      if (missingTags.length > 0) {
        return {
          status: 'unhealthy',
          responseTime,
          error: `Missing required tags: ${missingTags.join(', ')}`,
          timestamp,
        };
      }

      if (responseTime >= 5000) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'Response time exceeded 5 seconds',
          timestamp,
        };
      }

      this.logger.debug(`AO Token Info check passed in ${responseTime}ms`);
      return {
        status: 'healthy',
        responseTime,
        timestamp,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AO Token Info check failed: ${errorMessage}`);
      return {
        status: 'unhealthy',
        responseTime,
        error: errorMessage,
        timestamp,
      };
    }
  }

  async checkAoTokenBalance(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    const { dryrun: aoDryrun } = connect({
      MU_URL: 'https://mu.ao-testnet.xyz',
      CU_URL: 'https://cu.ao-testnet.xyz',
      GATEWAY_URL: 'https://arweave.net',
      MODE: 'legacy',
    });

    try {
      const result = await this.retryDryrun(
        {
          dryrunFn: aoDryrun,
          process: AO_PROCESS_ID,
          tags: [
            { name: 'Action', value: 'Balance' },
            { name: 'Recipient', value: TEST_ADDRESS },
          ],
        },
        'AO Token Balance',
      );

      const responseTime = Date.now() - startTime;

      if (!result.Messages || !result.Messages[0]) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'No messages in response',
          timestamp,
        };
      }

      if (!result.Messages[0].Data) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'No data field in response',
          timestamp,
        };
      }

      if (responseTime >= 5000) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'Response time exceeded 5 seconds',
          timestamp,
        };
      }

      this.logger.debug(`AO Token Balance check passed in ${responseTime}ms`);
      return {
        status: 'healthy',
        responseTime,
        timestamp,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AO Token Balance check failed: ${errorMessage}`);
      return {
        status: 'unhealthy',
        responseTime,
        error: errorMessage,
        timestamp,
      };
    }
  }

  getHealthStatus(): HealthStatus {
    return this.healthStatus;
  }
}
