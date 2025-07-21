import axios from 'axios';
import { SlackConfig } from '@remote-claude/core';
import { TemplateContent } from '../templates/engine';
import chalk from 'chalk';

export class SlackNotifier {
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  /**
   * Send Slack notification
   */
  async send(content: TemplateContent): Promise<any> {
    try {
      if (!this.config.webhookUrl) {
        throw new Error('Slack webhook URL is required');
      }

      let payload: any;

      // Try to parse as JSON for rich formatting
      if (content.format === 'markdown' || content.body.trim().startsWith('{')) {
        try {
          payload = JSON.parse(content.body);
        } catch {
          // Fall back to simple text message
          payload = {
            text: content.body,
            channel: this.config.channel,
            username: this.config.username || 'Remote Claude CLI',
            icon_emoji: this.config.iconEmoji || ':robot_face:',
            icon_url: this.config.iconUrl,
          };
        }
      } else {
        // Simple text message
        payload = {
          text: content.body,
          channel: this.config.channel,
          username: this.config.username || 'Remote Claude CLI',
          icon_emoji: this.config.iconEmoji || ':robot_face:',
          icon_url: this.config.iconUrl,
        };
      }

      // Ensure channel is set
      if (!payload.channel) {
        payload.channel = this.config.channel;
      }

      const response = await axios.post(this.config.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200 && response.data === 'ok') {
        console.log(chalk.green(`✅ Slack message sent to ${this.config.channel}`));
        return response.data;
      } else {
        throw new Error(`Slack API returned: ${response.status} ${response.data}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Slack notification failed:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Test Slack configuration
   */
  async test(): Promise<boolean> {
    try {
      const testPayload = {
        text: '🧪 Test notification from Remote Claude CLI',
        channel: this.config.channel,
        username: this.config.username || 'Remote Claude CLI',
        icon_emoji: this.config.iconEmoji || ':robot_face:',
      };

      if (!this.config.webhookUrl) {
        throw new Error('Slack webhook URL is required');
      }

      const response = await axios.post(this.config.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200 && response.data === 'ok') {
        console.log(chalk.green('✅ Slack configuration is valid'));
        return true;
      } else {
        throw new Error(`Slack API returned: ${response.status} ${response.data}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Slack configuration test failed:'), (error as Error).message);
      return false;
    }
  }

  /**
   * Create rich message blocks for better formatting
   */
  private createRichMessage(content: TemplateContent): any {
    return {
      channel: this.config.channel,
      username: this.config.username || 'Remote Claude CLI',
      icon_emoji: this.config.iconEmoji || ':robot_face:',
      icon_url: this.config.iconUrl,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: content.title || 'Remote Claude Notification',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: content.body,
          },
        },
      ],
    };
  }

  /**
   * Convert text to Slack markdown format
   */
  private convertToSlackMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
      .replace(/(?<!\*)\*(?!\*)(.*?)\*/g, '_$1_') // Italic
      .replace(/`(.*?)`/g, '`$1`') // Code (already correct)
      .replace(/^# (.*$)/gm, '*$1*') // Headers to bold
      .replace(/^## (.*$)/gm, '*$1*')
      .replace(/^### (.*$)/gm, '*$1*');
  }
}