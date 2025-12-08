import axios from 'axios';
import { PushoverConfig } from '@remote-claude/core';
import { TemplateContent } from '../templates/engine';
import chalk from 'chalk';

export class PushoverNotifier {
  private config: PushoverConfig;
  private readonly apiUrl = 'https://api.pushover.net/1/messages.json';

  constructor(config: PushoverConfig) {
    this.config = config;
  }

  /**
   * Send Pushover notification
   */
  async send(content: TemplateContent): Promise<any> {
    try {
      const payload = {
        token: this.config.appToken,
        user: this.config.userKey,
        message: content.body,
        title: content.title || content.subject || 'Remote Claude Notification',
        device: this.config.device,
        priority: this.config.priority || 0,
        sound: this.config.sound || 'pushover',
        html: content.format === 'html' ? 1 : 0,
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Remove undefined values
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof typeof payload] === undefined) {
          delete payload[key as keyof typeof payload];
        }
      });

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        transformRequest: [
          (data) => {
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
              params.append(key, data[key]);
            });
            return params.toString();
          }
        ],
      });

      if (response.status === 200 && response.data.status === 1) {
        console.log(chalk.green(`✅ Pushover notification sent (ID: ${response.data.request})`));
        return response.data;
      } else {
        throw new Error(`Pushover API error: ${response.data.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Pushover notification failed:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Test Pushover configuration
   */
  async test(): Promise<boolean> {
    try {
      const testPayload = {
        token: this.config.appToken,
        user: this.config.userKey,
        message: '🧪 Test notification from Remote Claude CLI',
        title: 'Test Notification',
        priority: 0,
        sound: this.config.sound || 'pushover',
      };

      const response = await axios.post(this.apiUrl, testPayload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        transformRequest: [
          (data) => {
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
              params.append(key, data[key]);
            });
            return params.toString();
          }
        ],
      });

      if (response.status === 200 && response.data.status === 1) {
        console.log(chalk.green('✅ Pushover configuration is valid'));
        return true;
      } else {
        throw new Error(`Pushover API error: ${response.data.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Pushover configuration test failed:'), (error as Error).message);
      return false;
    }
  }

  /**
   * Validate user key
   */
  async validateUser(): Promise<boolean> {
    try {
      const response = await axios.post('https://api.pushover.net/1/users/validate.json', {
        token: this.config.appToken,
        user: this.config.userKey,
        device: this.config.device,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        transformRequest: [
          (data) => {
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
              if (data[key] !== undefined) {
                params.append(key, data[key]);
              }
            });
            return params.toString();
          }
        ],
      });

      return response.status === 200 && response.data.status === 1;
    } catch (error) {
      console.error(chalk.red('❌ Pushover user validation failed:'), (error as Error).message);
      return false;
    }
  }

  /**
   * Get available sounds
   */
  async getSounds(): Promise<string[]> {
    try {
      const response = await axios.get(`https://api.pushover.net/1/sounds.json?token=${this.config.appToken}`);
      
      if (response.status === 200 && response.data.sounds) {
        return Object.keys(response.data.sounds);
      }
      
      return [];
    } catch (error) {
      console.error(chalk.red('❌ Failed to get Pushover sounds:'), (error as Error).message);
      return [];
    }
  }

  /**
   * Check receipt status (for priority 2 messages)
   */
  async checkReceipt(receipt: string): Promise<any> {
    try {
      const response = await axios.get(`https://api.pushover.net/1/receipts/${receipt}.json?token=${this.config.appToken}`);
      return response.data;
    } catch (error) {
      console.error(chalk.red('❌ Failed to check Pushover receipt:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Get message limits
   */
  async getLimits(): Promise<{
    limit: number;
    remaining: number;
    reset: number;
  }> {
    try {
      // Make a test request to get rate limit headers
      const response = await axios.post('https://api.pushover.net/1/users/validate.json', {
        token: this.config.appToken,
        user: this.config.userKey,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        transformRequest: [
          (data) => {
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
              params.append(key, data[key]);
            });
            return params.toString();
          }
        ],
      });

      return {
        limit: parseInt(response.headers['x-limit-app-limit'] || '7500'),
        remaining: parseInt(response.headers['x-limit-app-remaining'] || '7500'),
        reset: parseInt(response.headers['x-limit-app-reset'] || '0'),
      };
    } catch (error) {
      console.error(chalk.red('❌ Failed to get Pushover limits:'), (error as Error).message);
      return { limit: 0, remaining: 0, reset: 0 };
    }
  }
}