import axios, { AxiosRequestConfig } from 'axios';
import { WebhookConfig } from '../types';
import { TemplateContent } from '../templates/engine';
import chalk from 'chalk';

export class WebhookNotifier {
  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
    this.config = config;
  }

  /**
   * Send webhook notification
   */
  async send(content: TemplateContent): Promise<any> {
    try {
      const requestConfig: AxiosRequestConfig = {
        method: this.config.method,
        url: this.config.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Remote-Claude-CLI/1.0.0',
          ...this.config.headers,
        },
        timeout: 10000, // 10 second timeout
      };

      // Add authentication
      if (this.config.auth) {
        this.addAuthentication(requestConfig);
      }

      // Prepare payload
      let payload: any;
      
      if (content.format === 'html' || content.body.trim().startsWith('{')) {
        try {
          payload = JSON.parse(content.body);
        } catch {
          // If not valid JSON, wrap in a standard structure
          payload = {
            notification: {
              title: content.title || content.subject,
              body: content.body,
              format: content.format,
              timestamp: new Date().toISOString(),
              source: 'remote-claude-cli',
            },
          };
        }
      } else {
        payload = {
          notification: {
            title: content.title || content.subject,
            body: content.body,
            format: content.format,
            timestamp: new Date().toISOString(),
            source: 'remote-claude-cli',
          },
        };
      }

      requestConfig.data = payload;

      const response = await axios.request(requestConfig);

      if (response.status >= 200 && response.status < 300) {
        console.log(chalk.green(`✅ Webhook sent to ${this.config.url} (${response.status})`));
        return response.data;
      } else {
        throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Webhook notification failed:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Test webhook configuration
   */
  async test(): Promise<boolean> {
    try {
      const testPayload = {
        notification: {
          title: 'Test Notification',
          body: '🧪 Test notification from Remote Claude CLI',
          format: 'text',
          timestamp: new Date().toISOString(),
          source: 'remote-claude-cli',
          test: true,
        },
      };

      const requestConfig: AxiosRequestConfig = {
        method: this.config.method,
        url: this.config.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Remote-Claude-CLI/1.0.0',
          ...this.config.headers,
        },
        data: testPayload,
        timeout: 10000,
      };

      // Add authentication
      if (this.config.auth) {
        this.addAuthentication(requestConfig);
      }

      const response = await axios.request(requestConfig);

      if (response.status >= 200 && response.status < 300) {
        console.log(chalk.green('✅ Webhook configuration is valid'));
        return true;
      } else {
        throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Webhook configuration test failed:'), (error as Error).message);
      return false;
    }
  }

  /**
   * Add authentication to request config
   */
  private addAuthentication(requestConfig: AxiosRequestConfig): void {
    if (!this.config.auth) return;

    switch (this.config.auth.type) {
      case 'bearer':
        if (this.config.auth.token) {
          requestConfig.headers!['Authorization'] = `Bearer ${this.config.auth.token}`;
        }
        break;

      case 'basic':
        if (this.config.auth.username && this.config.auth.password) {
          const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
          requestConfig.headers!['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'api-key':
        if (this.config.auth.apiKey && this.config.auth.headerName) {
          requestConfig.headers![this.config.auth.headerName] = this.config.auth.apiKey;
        }
        break;

      default:
        console.warn(chalk.yellow(`⚠️  Unknown auth type: ${this.config.auth.type}`));
    }
  }

  /**
   * Validate webhook URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get webhook status
   */
  async getStatus(): Promise<{
    url: string;
    method: string;
    accessible: boolean;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await axios.request({
        method: 'HEAD',
        url: this.config.url,
        timeout: 5000,
        validateStatus: () => true, // Don't throw on any status
      });

      return {
        url: this.config.url,
        method: this.config.method,
        accessible: response.status < 500,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        url: this.config.url,
        method: this.config.method,
        accessible: false,
        responseTime: Date.now() - startTime,
      };
    }
  }
}