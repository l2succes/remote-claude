import { cosmiconfigSync } from 'cosmiconfig';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export interface Config {
  github?: {
    token?: string;
    username?: string;
    defaultRepository?: string;
  };
  notifications?: {
    email?: string;
    slack?: {
      webhookUrl?: string;
    };
    pushover?: {
      appToken?: string;
      userKey?: string;
    };
    webhook?: string;
  };
  defaults?: {
    machine?: string;
    location?: string;
    idleTimeout?: number;
    autoCommit?: boolean;
    pullRequest?: boolean;
  };
  webhook?: {
    port?: number;
    host?: string;
  };
}

export class ConfigManager {
  private readonly appName = 'remote-claude';
  private readonly configFileName = '.rclirc';
  private configPath: string;
  private config: Config;
  private explorer: any;

  constructor() {
    this.configPath = path.join(os.homedir(), this.configFileName);
    this.explorer = cosmiconfigSync(this.appName, {
      searchPlaces: [
        this.configFileName,
        `${this.configFileName}.json`,
        `${this.configFileName}.yaml`,
        `${this.configFileName}.yml`,
        `${this.configFileName}.js`,
        'package.json',
      ],
    });
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): Config {
    try {
      // First try to load from home directory
      const homeConfig = this.explorer.load(this.configPath);
      if (homeConfig) {
        return homeConfig.config;
      }

      // Then search for config in current directory and up
      const result = this.explorer.search();
      if (result) {
        return result.config;
      }

      // Return empty config if none found
      return {};
    } catch (error) {
      console.error(chalk.yellow('⚠️  Error loading config:'), error.message);
      return {};
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      const configContent = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configPath, configContent, 'utf8');
      console.log(chalk.green('✅ Configuration saved to:'), this.configPath);
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Get the entire configuration
   */
  getAll(): Config {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  get<T>(path: string): T | undefined {
    const keys = path.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current[key] === undefined) {
        return undefined;
      }
      current = current[key];
    }
    
    return current as T;
  }

  /**
   * Set a configuration value
   */
  set(path: string, value: any): void {
    const keys = path.split('.');
    let current: any = this.config;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the value
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  /**
   * Configure GitHub settings
   */
  async configureGitHub(options: {
    token?: string;
    username?: string;
    repository?: string;
  }): Promise<void> {
    if (!this.config.github) {
      this.config.github = {};
    }

    if (options.token !== undefined) {
      this.config.github.token = options.token;
      console.log(chalk.green('✅ GitHub token configured'));
    }

    if (options.username !== undefined) {
      this.config.github.username = options.username;
      console.log(chalk.green('✅ GitHub username set:'), options.username);
    }

    if (options.repository !== undefined) {
      this.config.github.defaultRepository = options.repository;
      console.log(chalk.green('✅ Default repository set:'), options.repository);
    }

    await this.saveConfig();
  }

  /**
   * Configure notification settings
   */
  async configureNotifications(options: {
    email?: string;
    slack?: string;
    pushover?: string;
    webhook?: string;
  }): Promise<void> {
    if (!this.config.notifications) {
      this.config.notifications = {};
    }

    if (options.email !== undefined) {
      this.config.notifications.email = options.email;
      console.log(chalk.green('✅ Email notifications configured'));
    }

    if (options.slack !== undefined) {
      if (!this.config.notifications.slack) {
        this.config.notifications.slack = {};
      }
      this.config.notifications.slack.webhookUrl = options.slack;
      console.log(chalk.green('✅ Slack webhook configured'));
    }

    if (options.pushover !== undefined) {
      const [appToken, userKey] = options.pushover.split(':');
      if (!appToken || !userKey) {
        throw new Error('Pushover config must be in format: app-token:user-key');
      }
      this.config.notifications.pushover = { appToken, userKey };
      console.log(chalk.green('✅ Pushover configured'));
    }

    if (options.webhook !== undefined) {
      this.config.notifications.webhook = options.webhook;
      console.log(chalk.green('✅ Custom webhook configured'));
    }

    await this.saveConfig();
  }

  /**
   * Get GitHub token (from config or environment)
   */
  getGitHubToken(): string | undefined {
    return this.config.github?.token || process.env.GITHUB_TOKEN;
  }

  /**
   * Get default repository
   */
  getDefaultRepository(): string | undefined {
    return this.config.github?.defaultRepository;
  }

  /**
   * Check if configuration is valid for running tasks
   */
  isConfigured(): boolean {
    const token = this.getGitHubToken();
    return !!token;
  }

  /**
   * Get webhook configuration
   */
  getWebhookConfig(): { port: number; host: string } {
    return {
      port: this.config.webhook?.port || 3000,
      host: this.config.webhook?.host || 'localhost',
    };
  }

  /**
   * Display current configuration (with sensitive data masked)
   */
  displayConfig(): void {
    const config = this.getAll();
    
    console.log(chalk.blue('📋 Current Configuration:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    // GitHub
    if (config.github) {
      console.log(chalk.yellow('GitHub:'));
      if (config.github.token) {
        console.log(`  Token: ${chalk.gray('****' + config.github.token.slice(-4))}`);
      }
      if (config.github.username) {
        console.log(`  Username: ${chalk.green(config.github.username)}`);
      }
      if (config.github.defaultRepository) {
        console.log(`  Default Repo: ${chalk.green(config.github.defaultRepository)}`);
      }
    }
    
    // Notifications
    if (config.notifications) {
      console.log(chalk.yellow('\nNotifications:'));
      if (config.notifications.email) {
        console.log(`  Email: ${chalk.green(config.notifications.email)}`);
      }
      if (config.notifications.slack?.webhookUrl) {
        console.log(`  Slack: ${chalk.gray('****' + config.notifications.slack.webhookUrl.slice(-10))}`);
      }
      if (config.notifications.pushover) {
        console.log(`  Pushover: ${chalk.green('Configured')}`);
      }
      if (config.notifications.webhook) {
        console.log(`  Webhook: ${chalk.green(config.notifications.webhook)}`);
      }
    }
    
    // Defaults
    if (config.defaults) {
      console.log(chalk.yellow('\nDefaults:'));
      Object.entries(config.defaults).forEach(([key, value]) => {
        console.log(`  ${key}: ${chalk.green(value)}`);
      });
    }
    
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray(`Config file: ${this.configPath}`));
  }
}