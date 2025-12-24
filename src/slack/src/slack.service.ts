import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { slackAlertPrefaceMap, AlertType } from './slack.constants';

@Injectable()
export class SlackService {
  private infraAlertsWebhookUrl: string;
  private integrationRequestsWebhookUrl: string;
  constructor(private readonly configService: ConfigService) {
    this.infraAlertsWebhookUrl =
      this.configService.get<string>('SLACK_INFRA_ALERTS_WEBHOOK') || '';
  }

  async sendAlert({ text, type }: { text: string; type: AlertType }) {
    return await axios.post(this.infraAlertsWebhookUrl, {
      text: `${slackAlertPrefaceMap[type]} ${text.trim()}`,
    });
  }
}
