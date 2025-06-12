import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import chalk from 'chalk';
import { EventEmitter } from 'events';

export interface WebhookPayload {
  taskId: string;
  status: 'started' | 'running' | 'completed' | 'failed';
  timestamp: string;
  data?: {
    message?: string;
    progress?: number;
    output?: string[];
    error?: string;
    result?: any;
  };
}

export interface WebhookServerOptions {
  port?: number;
  host?: string;
}

export class WebhookServer extends EventEmitter {
  private app: Express;
  private server?: Server;
  private options: Required<WebhookServerOptions>;
  private taskWebhooks: Map<string, WebhookPayload[]> = new Map();

  constructor(options: WebhookServerOptions = {}) {
    super();
    this.options = {
      port: options.port || 3000,
      host: options.host || 'localhost',
    };
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(chalk.gray(`[${new Date().toISOString()}] ${req.method} ${req.path}`));
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Webhook endpoint for task updates
    this.app.post('/webhook/:taskId', (req: Request, res: Response) => {
      const { taskId } = req.params;
      const payload: WebhookPayload = {
        taskId,
        status: req.body.status || 'running',
        timestamp: new Date().toISOString(),
        data: req.body.data || {},
      };

      // Store webhook payload
      if (!this.taskWebhooks.has(taskId)) {
        this.taskWebhooks.set(taskId, []);
      }
      this.taskWebhooks.get(taskId)!.push(payload);

      // Emit event for real-time processing
      this.emit('webhook:received', payload);
      this.emit(`task:${taskId}:${payload.status}`, payload);

      // Log the update
      this.logWebhookUpdate(payload);

      res.json({ success: true, message: 'Webhook received' });
    });

    // Get webhook history for a task
    this.app.get('/webhooks/:taskId', (req: Request, res: Response) => {
      const { taskId } = req.params;
      const webhooks = this.taskWebhooks.get(taskId) || [];
      res.json({ taskId, webhooks });
    });

    // List all tasks with webhooks
    this.app.get('/webhooks', (req: Request, res: Response) => {
      const tasks = Array.from(this.taskWebhooks.keys()).map(taskId => {
        const webhooks = this.taskWebhooks.get(taskId) || [];
        const lastWebhook = webhooks[webhooks.length - 1];
        return {
          taskId,
          webhookCount: webhooks.length,
          lastStatus: lastWebhook?.status,
          lastUpdate: lastWebhook?.timestamp,
        };
      });
      res.json({ tasks });
    });

    // Clear webhook history for a task
    this.app.delete('/webhooks/:taskId', (req: Request, res: Response) => {
      const { taskId } = req.params;
      this.taskWebhooks.delete(taskId);
      res.json({ success: true, message: 'Webhook history cleared' });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      console.error(chalk.red('❌ Server error:'), err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private logWebhookUpdate(payload: WebhookPayload): void {
    const emoji = {
      started: '🚀',
      running: '⚡',
      completed: '✅',
      failed: '❌',
    }[payload.status] || '📌';

    console.log(chalk.blue(`${emoji} Task ${payload.taskId}: ${payload.status}`));
    
    if (payload.data?.message) {
      console.log(chalk.gray(`  Message: ${payload.data.message}`));
    }
    
    if (payload.data?.progress !== undefined) {
      console.log(chalk.gray(`  Progress: ${payload.data.progress}%`));
    }
    
    if (payload.data?.error) {
      console.log(chalk.red(`  Error: ${payload.data.error}`));
    }
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.options.port, this.options.host, () => {
          console.log(chalk.green('✅ Webhook server started'));
          console.log(chalk.gray(`  URL: http://${this.options.host}:${this.options.port}`));
          console.log(chalk.gray(`  Health check: http://${this.options.host}:${this.options.port}/health`));
          this.emit('server:started');
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.error(chalk.red(`❌ Port ${this.options.port} is already in use`));
          } else {
            console.error(chalk.red('❌ Server error:'), error);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(chalk.yellow('⏹️  Webhook server stopped'));
          this.emit('server:stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the current URL of the webhook server
   */
  getUrl(): string {
    return `http://${this.options.host}:${this.options.port}`;
  }

  /**
   * Get webhook endpoint for a specific task
   */
  getWebhookUrl(taskId: string): string {
    return `${this.getUrl()}/webhook/${taskId}`;
  }

  /**
   * Wait for a specific task status
   */
  async waitForTaskStatus(taskId: string, status: string, timeout = 300000): Promise<WebhookPayload | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeListener(`task:${taskId}:${status}`, handler);
        resolve(null);
      }, timeout);

      const handler = (payload: WebhookPayload) => {
        clearTimeout(timer);
        resolve(payload);
      };

      this.once(`task:${taskId}:${status}`, handler);
    });
  }

  /**
   * Clear all webhook history
   */
  clearAll(): void {
    this.taskWebhooks.clear();
    console.log(chalk.yellow('🗑️  Cleared all webhook history'));
  }
}

// Standalone server for testing
if (require.main === module) {
  const server = new WebhookServer({
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  });

  server.on('webhook:received', (payload) => {
    console.log(chalk.blue('📨 Webhook received:'), JSON.stringify(payload, null, 2));
  });

  server.start().catch((error) => {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 Shutting down...'));
    await server.stop();
    process.exit(0);
  });
}