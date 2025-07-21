import { cosmiconfigSync } from 'cosmiconfig';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export interface ConfigV2 {
  // Default compute backend
  defaultBackend?: 'codespace' | 'aws' | 'fly' | 'local';
  
  // GitHub configuration
  github?: {
    token?: string;
    username?: string;
    defaultRepository?: string;
    defaultMachine?: string;
    defaultIdleTimeout?: number;
  };
  
  // AWS configuration (unified)
  aws?: {
    mode?: 'ec2' | 'ecs' | 'fargate';
    region?: string;
    
    // EC2 mode settings
    ec2?: {
      instanceType?: string;
      keyPair?: string;
      securityGroup?: string;
      subnet?: string;
      spotInstance?: boolean;
      idleTimeout?: number;
    };
    
    // ECS mode settings
    ecs?: {
      clusterName?: string;
      instanceType?: string;
      taskDefinitionArn?: string;
      subnetIds?: string[];
      securityGroupIds?: string[];
    };
  };
  
  
  // Notifications
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
  
  // Task defaults
  defaults?: {
    timeout?: number;
    priority?: string;
    autoCommit?: boolean;
    pullRequest?: boolean;
    notifyOnComplete?: boolean;
    notifyOnFail?: boolean;
  };
  
  // Webhook server
  webhook?: {
    port?: number;
    host?: string;
  };
}

export class ConfigManagerV2 {
  private readonly appName = 'rclaude';
  private readonly globalConfigName = '.rclauderc';
  private readonly projectConfigName = '.rclaude.json';
  private globalConfigPath: string;
  private globalConfig: ConfigV2;
  private projectConfig: ConfigV2 | null = null;
  private projectConfigPath: string | null = null;
  private explorer: any;

  constructor() {
    this.globalConfigPath = path.join(os.homedir(), this.globalConfigName);
    this.explorer = cosmiconfigSync(this.appName, {
      searchPlaces: [
        this.projectConfigName,
        `.${this.projectConfigName}`,
        `${this.projectConfigName}.yaml`,
        `${this.projectConfigName}.yml`,
        'package.json',
      ],
      packageProp: 'rclaude',
    });
    
    this.globalConfig = this.loadGlobalConfig();
    this.loadProjectConfig();
  }

  /**
   * Load global configuration from home directory
   */
  private loadGlobalConfig(): ConfigV2 {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.globalConfigPath)) {
        const content = fs.readFileSync(this.globalConfigPath, 'utf8');
        return JSON.parse(content);
      }
      return {};
    } catch (error) {
      console.error(chalk.yellow('⚠️  Error loading global config:'), (error as Error).message);
      return {};
    }
  }

  /**
   * Load project-level configuration
   */
  private loadProjectConfig(): void {
    try {
      const result = this.explorer.search();
      if (result) {
        this.projectConfig = result.config;
        this.projectConfigPath = result.filepath;
      }
    } catch (error) {
      // Project config is optional, so we can ignore errors
    }
  }

  /**
   * Save global configuration
   */
  async saveGlobalConfig(): Promise<void> {
    try {
      const configContent = JSON.stringify(this.globalConfig, null, 2);
      await fs.writeFile(this.globalConfigPath, configContent, 'utf8');
      console.log(chalk.green('✅ Global configuration saved to:'), this.globalConfigPath);
    } catch (error) {
      throw new Error(`Failed to save global config: ${(error as Error).message}`);
    }
  }

  /**
   * Save project configuration
   */
  async saveProjectConfig(): Promise<void> {
    if (!this.projectConfig) {
      this.projectConfig = {};
    }
    
    const configPath = this.projectConfigPath || path.join(process.cwd(), this.projectConfigName);
    
    try {
      const configContent = JSON.stringify(this.projectConfig, null, 2);
      await fs.writeFile(configPath, configContent, 'utf8');
      console.log(chalk.green('✅ Project configuration saved to:'), configPath);
      this.projectConfigPath = configPath;
    } catch (error) {
      throw new Error(`Failed to save project config: ${(error as Error).message}`);
    }
  }

  /**
   * Get merged configuration (project overrides global)
   */
  getMergedConfig(): ConfigV2 {
    if (!this.projectConfig) {
      return { ...this.globalConfig };
    }
    
    // Deep merge with project config taking precedence
    return this.deepMerge(this.globalConfig, this.projectConfig);
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(output[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }

  /**
   * Get a configuration value (checks project first, then global)
   */
  get<T>(path: string): T | undefined {
    // Try project config first
    if (this.projectConfig) {
      const projectValue = this.getFromObject(this.projectConfig, path);
      if (projectValue !== undefined) {
        return projectValue as T;
      }
    }
    
    // Fall back to global config
    return this.getFromObject(this.globalConfig, path) as T;
  }

  /**
   * Get value from object using dot notation path
   */
  private getFromObject(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current[key] === undefined) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Set a configuration value
   */
  async set(path: string, value: any, scope: 'global' | 'project' = 'global'): Promise<void> {
    const config = scope === 'project' ? 
      (this.projectConfig || (this.projectConfig = {})) : 
      this.globalConfig;
    
    const keys = path.split('.');
    let current: any = config;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) continue;
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the value
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
    
    // Save the appropriate config
    if (scope === 'project') {
      await this.saveProjectConfig();
    } else {
      await this.saveGlobalConfig();
    }
  }

  /**
   * Configure default backend
   */
  async configureBackend(backend: 'codespace' | 'aws' | 'fly' | 'local', scope: 'global' | 'project' = 'global'): Promise<void> {
    
    await this.set('defaultBackend', backend, scope);
    console.log(chalk.green(`✅ Default backend set to: ${backend} (${scope})`));
  }

  /**
   * Get default backend
   */
  getDefaultBackend(): 'codespace' | 'aws' | 'fly' | 'local' {
    return this.get<'codespace' | 'aws' | 'fly' | 'local'>('defaultBackend') || 'codespace';
  }

  /**
   * Configure GitHub settings
   */
  async configureGitHub(options: {
    token?: string;
    username?: string;
    repository?: string;
    defaultMachine?: string;
    defaultIdleTimeout?: number;
  }, scope: 'global' | 'project' = 'global'): Promise<void> {
    const config = scope === 'project' ? 
      (this.projectConfig || (this.projectConfig = {})) : 
      this.globalConfig;
    
    if (!config.github) {
      config.github = {};
    }

    let hasChanges = false;

    if (options.token !== undefined) {
      config.github.token = options.token;
      console.log(chalk.green('✅ GitHub token configured'));
      hasChanges = true;
    }

    if (options.username !== undefined) {
      config.github.username = options.username;
      console.log(chalk.green('✅ GitHub username set:'), options.username);
      hasChanges = true;
    }

    if (options.repository !== undefined) {
      config.github.defaultRepository = options.repository;
      console.log(chalk.green('✅ Default repository set:'), options.repository);
      hasChanges = true;
    }

    if (options.defaultMachine !== undefined) {
      config.github.defaultMachine = options.defaultMachine;
      console.log(chalk.green('✅ Default machine type set:'), options.defaultMachine);
      hasChanges = true;
    }

    if (options.defaultIdleTimeout !== undefined) {
      config.github.defaultIdleTimeout = options.defaultIdleTimeout;
      console.log(chalk.green('✅ Default idle timeout set:'), options.defaultIdleTimeout, 'minutes');
      hasChanges = true;
    }

    if (hasChanges) {
      if (scope === 'project') {
        await this.saveProjectConfig();
      } else {
        await this.saveGlobalConfig();
      }
    }
  }

  /**
   * Configure AWS settings
   */
  async configureAWS(options: {
    mode?: 'ec2' | 'ecs' | 'fargate';
    region?: string;
    ec2?: {
      instanceType?: string;
      spotInstance?: boolean;
      idleTimeout?: number;
    };
    ecs?: {
      clusterName?: string;
      instanceType?: string;
    };
  }, scope: 'global' | 'project' = 'global'): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (options.mode !== undefined) {
      promises.push(this.set('aws.mode', options.mode, scope));
    }
    if (options.region !== undefined) {
      promises.push(this.set('aws.region', options.region, scope));
    }
    
    // Mode-specific settings
    if (options.ec2) {
      Object.entries(options.ec2).forEach(([key, value]) => {
        promises.push(this.set(`aws.ec2.${key}`, value, scope));
      });
    }
    if (options.ecs) {
      Object.entries(options.ecs).forEach(([key, value]) => {
        promises.push(this.set(`aws.ecs.${key}`, value, scope));
      });
    }
    
    await Promise.all(promises);
    console.log(chalk.green(`✅ AWS configuration updated (${scope})`));
  }
  
  /**
   * Get AWS mode (with migration from old backends)
   */
  getAWSMode(): 'ec2' | 'ecs' | 'fargate' {
    // Check if AWS mode is explicitly set
    const awsMode = this.get<'ec2' | 'ecs' | 'fargate'>('aws.mode');
    if (awsMode) return awsMode;
    
    // Default to ECS for AWS
    return 'ecs';
  }
  

  /**
   * Display current configuration
   */
  displayConfig(showAll: boolean = false): void {
    const globalConfig = this.globalConfig;
    const projectConfig = this.projectConfig;
    const mergedConfig = this.getMergedConfig();
    
    console.log(chalk.blue('📋 Configuration Overview:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Default backend
    console.log(chalk.yellow('Default Backend:'), chalk.green(mergedConfig.defaultBackend || 'codespace'));
    
    if (showAll) {
      console.log(chalk.gray('\n─── Global Configuration ───'));
      this.displayConfigObject(globalConfig, '  ');
      
      if (projectConfig) {
        console.log(chalk.gray('\n─── Project Configuration ───'));
        this.displayConfigObject(projectConfig, '  ');
      }
      
      console.log(chalk.gray('\n─── Merged Configuration ───'));
      this.displayConfigObject(mergedConfig, '  ');
    } else {
      // Show key settings
      if (mergedConfig.github) {
        console.log(chalk.yellow('\nGitHub:'));
        if (mergedConfig.github.defaultRepository) {
          console.log(`  Repository: ${chalk.green(mergedConfig.github.defaultRepository)}`);
        }
        if (mergedConfig.github.defaultMachine) {
          console.log(`  Machine: ${chalk.green(mergedConfig.github.defaultMachine)}`);
        }
      }
      
      if (mergedConfig.aws) {
        console.log(chalk.yellow('\nAWS:'));
        if (mergedConfig.aws.mode) {
          console.log(`  Mode: ${chalk.green(mergedConfig.aws.mode)}`);
        }
        if (mergedConfig.aws.region) {
          console.log(`  Region: ${chalk.green(mergedConfig.aws.region)}`);
        }
      }
    }
    
    console.log(chalk.gray('\n─'.repeat(50)));
    console.log(chalk.gray(`Global config: ${this.globalConfigPath}`));
    if (this.projectConfigPath) {
      console.log(chalk.gray(`Project config: ${this.projectConfigPath}`));
    }
  }

  /**
   * Display a configuration object recursively
   */
  private displayConfigObject(obj: any, indent: string = ''): void {
    Object.entries(obj).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        console.log(`${indent}${chalk.yellow(key)}:`);
        this.displayConfigObject(value, indent + '  ');
      } else {
        // Mask sensitive values
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
          const strValue = String(value);
          console.log(`${indent}${key}: ${chalk.gray('****' + strValue.slice(-4))}`);
        } else {
          console.log(`${indent}${key}: ${chalk.green(value)}`);
        }
      }
    });
  }

  /**
   * Check if configuration is valid
   */
  isConfigured(): boolean {
    const config = this.getMergedConfig();
    const backend = config.defaultBackend || 'codespace';
    
    if (backend === 'codespace') {
      return !!(config.github?.token || process.env.GITHUB_TOKEN);
    }
    
    return true;
  }

  /**
   * Get GitHub token
   */
  getGitHubToken(): string | undefined {
    return this.get<string>('github.token') || process.env.GITHUB_TOKEN;
  }

  /**
   * Get default repository
   */
  getDefaultRepository(): string | undefined {
    return this.get<string>('github.defaultRepository');
  }

  /**
   * Initialize a project configuration
   */
  async initProject(): Promise<void> {
    if (this.projectConfig) {
      console.log(chalk.yellow('⚠️  Project configuration already exists'));
      return;
    }
    
    this.projectConfig = {
      defaultBackend: this.globalConfig.defaultBackend || 'codespace',
    };
    
    await this.saveProjectConfig();
    console.log(chalk.green('✅ Created project configuration file'));
  }
}