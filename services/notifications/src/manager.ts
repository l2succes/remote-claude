import { EventEmitter } from 'events';
import { 
  NotificationPayload, 
  NotificationConfig, 
  NotificationResult, 
  NotificationQueue,
  NotificationStats,
  NotificationChannel,
  NotificationEvent,
  NotificationChannelConfig
} from './types';
import { EmailNotifier } from './channels/email';
import { SlackNotifier } from './channels/slack';
import { WebhookNotifier } from './channels/webhook';
import { PushoverNotifier } from './channels/pushover';
import { TemplateEngine } from './templates/engine';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

export interface NotificationManagerOptions {
  config: NotificationConfig;
  templateDir?: string | undefined;
}

export class NotificationManager extends EventEmitter {
  private config: NotificationConfig;
  private templateEngine: TemplateEngine;
  private notifiers: Map<NotificationChannel, any> = new Map();
  private queue: Map<string, NotificationQueue> = new Map();
  private stats: NotificationStats;
  private isProcessing: boolean = false;
  private processingTimer?: NodeJS.Timeout;

  constructor(options: NotificationManagerOptions) {
    super();
    this.config = options.config;
    this.templateEngine = new TemplateEngine(options.templateDir);
    
    this.stats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      byChannel: {
        email: { sent: 0, failed: 0, pending: 0 },
        slack: { sent: 0, failed: 0, pending: 0 },
        webhook: { sent: 0, failed: 0, pending: 0 },
        pushover: { sent: 0, failed: 0, pending: 0 },
      },
      byEvent: {
        'task:started': { sent: 0, failed: 0 },
        'task:completed': { sent: 0, failed: 0 },
        'task:failed': { sent: 0, failed: 0 },
        'task:cancelled': { sent: 0, failed: 0 },
        'task:timeout': { sent: 0, failed: 0 },
      },
    };

    this.initializeNotifiers();
    this.startProcessing();
  }

  /**
   * Initialize notification channel handlers
   */
  private initializeNotifiers(): void {
    if (!this.config.enabled) {
      console.log(chalk.gray('📵 Notifications are disabled'));
      return;
    }

    for (const channelConfig of this.config.channels) {
      if (!channelConfig.enabled) continue;

      try {
        let notifier;
        
        switch (channelConfig.channel) {
          case 'email':
            notifier = new EmailNotifier(channelConfig.config as any);
            break;
          case 'slack':
            notifier = new SlackNotifier(channelConfig.config as any);
            break;
          case 'webhook':
            notifier = new WebhookNotifier(channelConfig.config as any);
            break;
          case 'pushover':
            notifier = new PushoverNotifier(channelConfig.config as any);
            break;
          default:
            console.warn(chalk.yellow(`⚠️  Unknown notification channel: ${channelConfig.channel}`));
            continue;
        }

        this.notifiers.set(channelConfig.channel, notifier);
        console.log(chalk.green(`✅ ${channelConfig.channel} notifier initialized`));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to initialize ${channelConfig.channel} notifier:`), (error as Error).message);
      }
    }
  }

  /**
   * Send a notification
   */
  async notify(payload: NotificationPayload): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const queueId = uuidv4().substring(0, 8);
    const channels = this.getChannelsForEvent(payload.event);
    
    if (channels.length === 0) {
      console.log(chalk.gray(`📵 No channels configured for event: ${payload.event}`));
      return;
    }

    const queueItem: NotificationQueue = {
      id: queueId,
      payload,
      channels,
      attempts: 0,
      maxAttempts: this.config.retryAttempts || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.queue.set(queueId, queueItem);
    this.updateStats('pending', channels);
    
    console.log(chalk.blue(`📨 Notification queued: ${payload.event} for task ${payload.task.id}`));
    this.emit('notification:queued', queueItem);
  }

  /**
   * Get channels that should receive notifications for an event
   */
  private getChannelsForEvent(event: NotificationEvent): NotificationChannel[] {
    return this.config.channels
      .filter(config => config.enabled && config.events.includes(event))
      .map(config => config.channel)
      .filter(channel => this.notifiers.has(channel));
  }

  /**
   * Start processing the notification queue
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, 5000); // Process every 5 seconds
    
    console.log(chalk.green('🔄 Notification processing started'));
  }

  /**
   * Stop processing notifications
   */
  stop(): void {
    this.isProcessing = false;
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined as any;
    }
    console.log(chalk.yellow('⏹️  Notification processing stopped'));
  }

  /**
   * Process the notification queue
   */
  private async processQueue(): Promise<void> {
    const now = new Date();
    const batchSize = this.config.batchSize || 10;
    let processed = 0;

    for (const [queueId, queueItem] of this.queue.entries()) {
      if (processed >= batchSize) break;

      // Skip if not ready for retry
      if (queueItem.nextRetry && queueItem.nextRetry > now) {
        continue;
      }

      try {
        await this.processNotification(queueItem);
        this.queue.delete(queueId);
        processed++;
      } catch (error) {
        console.error(chalk.red('❌ Failed to process notification:'), (error as Error).message);
        
        queueItem.attempts++;
        queueItem.updatedAt = now;
        
        if (queueItem.attempts >= queueItem.maxAttempts) {
          console.log(chalk.red(`❌ Notification failed after ${queueItem.maxAttempts} attempts: ${queueId}`));
          this.updateStats('failed', queueItem.channels);
          this.queue.delete(queueId);
          this.emit('notification:failed', queueItem, error);
        } else {
          // Schedule retry
          const retryDelay = (this.config.retryDelay || 30000) * Math.pow(2, queueItem.attempts - 1);
          queueItem.nextRetry = new Date(now.getTime() + retryDelay);
          console.log(chalk.yellow(`⏰ Notification retry scheduled: ${queueId} (attempt ${queueItem.attempts}/${queueItem.maxAttempts})`));
        }
      }
    }
  }

  /**
   * Process a single notification
   */
  private async processNotification(queueItem: NotificationQueue): Promise<void> {
    const { payload, channels } = queueItem;
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      const notifier = this.notifiers.get(channel);
      if (!notifier) {
        console.warn(chalk.yellow(`⚠️  No notifier found for channel: ${channel}`));
        continue;
      }

      const startTime = Date.now();
      try {
        // Render template
        const content = await this.templateEngine.render(payload, channel);
        
        // Send notification
        const response = await notifier.send(content);
        
        const duration = Date.now() - startTime;
        const result: NotificationResult = {
          id: queueItem.id,
          channel,
          success: true,
          timestamp: new Date(),
          duration,
          response,
        };
        
        results.push(result);
        console.log(chalk.green(`✅ ${channel} notification sent for task ${payload.task.id} (${duration}ms)`));
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const result: NotificationResult = {
          id: queueItem.id,
          channel,
          success: false,
          timestamp: new Date(),
          duration,
          error: (error as Error).message,
        };
        
        results.push(result);
        console.error(chalk.red(`❌ ${channel} notification failed for task ${payload.task.id}:`), (error as Error).message);
      }
    }

    // Update statistics
    const successfulChannels = results.filter(r => r.success).map(r => r.channel);
    const failedChannels = results.filter(r => !r.success).map(r => r.channel);
    
    this.updateStats('sent', successfulChannels);
    this.updateStats('failed', failedChannels);
    this.updateStats('pending', channels, -1);

    this.emit('notification:processed', queueItem, results);
  }

  /**
   * Update notification statistics
   */
  private updateStats(type: 'sent' | 'failed' | 'pending', channels: NotificationChannel[], delta: number = 1): void {
    for (const channel of channels) {
      this.stats.byChannel[channel][type] += delta;
    }
    
    if (type === 'sent') {
      this.stats.sent += delta * channels.length;
    } else if (type === 'failed') {
      this.stats.failed += delta * channels.length;
    } else if (type === 'pending') {
      this.stats.pending += delta * channels.length;
    }
    
    this.stats.total = this.stats.sent + this.stats.failed + this.stats.pending;
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    return { ...this.stats };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    size: number;
    items: NotificationQueue[];
  } {
    return {
      size: this.queue.size,
      items: Array.from(this.queue.values()),
    };
  }

  /**
   * Clear completed notifications from queue
   */
  clearQueue(): number {
    const size = this.queue.size;
    this.queue.clear();
    console.log(chalk.gray(`🧹 Cleared ${size} items from notification queue`));
    return size;
  }

  /**
   * Test a notification channel
   */
  async testChannel(channel: NotificationChannel, testMessage: string = 'Test notification from Remote Claude CLI'): Promise<boolean> {
    const notifier = this.notifiers.get(channel);
    if (!notifier) {
      throw new Error(`No notifier configured for channel: ${channel}`);
    }

    try {
      await notifier.send({
        subject: 'Test Notification',
        title: 'Test Notification',
        body: testMessage,
        format: 'text' as const,
      });
      
      console.log(chalk.green(`✅ ${channel} test notification sent successfully`));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ ${channel} test notification failed:`), (error as Error).message);
      return false;
    }
  }

  /**
   * Get channel configuration
   */
  getChannelConfig(channel: NotificationChannel): NotificationChannelConfig | undefined {
    return this.config.channels.find(config => config.channel === channel);
  }

  /**
   * Update channel configuration
   */
  updateChannelConfig(channel: NotificationChannel, config: Partial<NotificationChannelConfig>): boolean {
    const channelIndex = this.config.channels.findIndex(c => c.channel === channel);
    if (channelIndex === -1) {
      return false;
    }

    const existingConfig = this.config.channels[channelIndex];
    if (existingConfig) {
      Object.assign(existingConfig, config);
    }
    
    // Reinitialize the notifier if config changed
    if (config.config) {
      this.initializeNotifiers();
    }
    
    return true;
  }
}