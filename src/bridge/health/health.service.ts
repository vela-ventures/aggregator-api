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

const TEST_ADDRESS = 'EvymyYyJOvSxTkcFO-tnFnY_kNEJV_vovocH7o-2pXw';

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
      } else {
        const currentFailures = (this.consecutiveFailures.get(type) || 0) + 1;
        this.consecutiveFailures.set(type, currentFailures);

        if (currentFailures === 3) {
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

  private formatFailureAlert(
    checkName: string,
    result: HealthCheckResult,
  ): string {
    const lines = [
      `Bridge Health Check Failed: ${checkName}`,
      result.error ? `Error: ${result.error}` : 'Unknown error',
      `Response Time: ${result.responseTime}ms`,
      `Timestamp: ${result.timestamp}`,
    ];
    return lines.join('\n');
  }

  async checkArioTokenInfo(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const { dryrun: arioDryrun } = connect({
        CU_URL: ARIO_CU_URL,
        MODE: ARIO_MODE,
      });

      const result = (await Promise.race([
        arioDryrun({
          process: ARIO_PROCESS_ID,
          tags: [{ name: 'Action', value: 'Info' }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000),
        ),
      ])) as DryrunResult;

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

      const result = (await Promise.race([
        arioDryrun({
          process: ARIO_PROCESS_ID,
          tags: [
            { name: 'Action', value: 'Balance' },
            { name: 'Recipient', value: TEST_ADDRESS },
          ],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000),
        ),
      ])) as DryrunResult;

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

    try {
      const result = (await Promise.race([
        dryrun({
          process: AO_PROCESS_ID,
          tags: [{ name: 'Action', value: 'Info' }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000),
        ),
      ])) as DryrunResult;

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

    try {
      const result = (await Promise.race([
        dryrun({
          process: AO_PROCESS_ID,
          tags: [
            { name: 'Action', value: 'Balance' },
            { name: 'Recipient', value: TEST_ADDRESS },
          ],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000),
        ),
      ])) as DryrunResult;

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
