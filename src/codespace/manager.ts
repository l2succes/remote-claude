import { GitHubAPI, Codespace, CodespaceOptions } from './github-api';
import { EventEmitter } from 'events';
import chalk from 'chalk';

export interface TaskOptions {
  task: string;
  repository: string;
  branch?: string;
  timeout?: number;
  autoCommit?: boolean;
  pullRequest?: boolean;
  outputFiles?: string[];
}

export interface CodespaceManagerOptions {
  token: string;
  webhookUrl?: string;
  defaultMachine?: string;
  defaultLocation?: string;
  defaultIdleTimeout?: number;
}

export class CodespaceManager extends EventEmitter {
  private api: GitHubAPI;
  private options: CodespaceManagerOptions;
  private activeCodespaces: Map<string, Codespace> = new Map();

  constructor(options: CodespaceManagerOptions) {
    super();
    this.options = options;
    this.api = new GitHubAPI(options.token);
  }

  /**
   * Create a new codespace for a task
   */
  async createCodespaceForTask(taskId: string, taskOptions: TaskOptions): Promise<Codespace> {
    console.log(chalk.blue('🔄 Creating codespace for task...'));
    
    const codespaceOptions: CodespaceOptions = {
      repository: taskOptions.repository,
      branch: taskOptions.branch,
      machine: this.options.defaultMachine || 'basicLinux32gb',
      location: this.options.defaultLocation,
      displayName: `rcli-${taskId}`,
      idleTimeoutMinutes: this.options.defaultIdleTimeout || 30,
      retentionPeriodMinutes: 60 * 24, // 24 hours
    };

    try {
      const codespace = await this.api.createCodespace(codespaceOptions);
      this.activeCodespaces.set(taskId, codespace);
      
      console.log(chalk.green('✅ Codespace created:'), codespace.name);
      this.emit('codespace:created', { taskId, codespace });
      
      // Wait for codespace to be available
      await this.waitForCodespaceReady(codespace.name);
      
      return codespace;
    } catch (error) {
      console.error(chalk.red('❌ Failed to create codespace:'), error.message);
      this.emit('codespace:error', { taskId, error });
      throw error;
    }
  }

  /**
   * Wait for a codespace to be ready
   */
  private async waitForCodespaceReady(name: string, maxAttempts = 60): Promise<void> {
    console.log(chalk.gray('⏳ Waiting for codespace to be ready...'));
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const codespace = await this.api.getCodespace(name);
        
        if (codespace.state === 'Available') {
          console.log(chalk.green('✅ Codespace is ready!'));
          return;
        }
        
        if (codespace.state === 'Failed') {
          throw new Error('Codespace creation failed');
        }
        
        // Show progress
        if (i % 5 === 0) {
          console.log(chalk.gray(`Status: ${codespace.state}...`));
        }
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw new Error(`Codespace not ready after ${maxAttempts * 5} seconds`);
        }
      }
    }
  }

  /**
   * Execute a task in a codespace
   */
  async executeTask(taskId: string, codespace: Codespace, taskOptions: TaskOptions): Promise<void> {
    console.log(chalk.blue('🚀 Executing task in codespace...'));
    
    try {
      // Install Claude Code in the codespace
      await this.installClaudeCode(codespace.name);
      
      // Set up webhook for status updates
      if (this.options.webhookUrl) {
        await this.setupWebhook(codespace.name, taskId);
      }
      
      // Execute the Claude Code command
      const command = this.buildClaudeCommand(taskOptions);
      console.log(chalk.gray('Command:'), command);
      
      // Note: Actual command execution would require SSH or GitHub CLI integration
      // For now, this is a placeholder
      console.log(chalk.yellow('⚠️  Task execution not fully implemented yet'));
      console.log(chalk.gray('Would execute:', command));
      
      this.emit('task:started', { taskId, codespace, command });
      
      // Simulate task completion for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.emit('task:completed', { taskId, codespace });
      
    } catch (error) {
      console.error(chalk.red('❌ Task execution failed:'), error.message);
      this.emit('task:failed', { taskId, codespace, error });
      throw error;
    }
  }

  /**
   * Install Claude Code in the codespace
   */
  private async installClaudeCode(codespaceName: string): Promise<void> {
    console.log(chalk.gray('📦 Installing Claude Code...'));
    
    // This would use SSH or GitHub CLI to install claude-code
    const installCommand = 'npm install -g claude-code';
    
    // Placeholder for actual implementation
    console.log(chalk.yellow('⚠️  Claude Code installation not implemented yet'));
  }

  /**
   * Set up webhook for status updates
   */
  private async setupWebhook(codespaceName: string, taskId: string): Promise<void> {
    if (!this.options.webhookUrl) return;
    
    console.log(chalk.gray('🔔 Setting up webhook...'));
    
    // This would configure the codespace to send updates to our webhook
    // Placeholder for actual implementation
    console.log(chalk.yellow('⚠️  Webhook setup not implemented yet'));
  }

  /**
   * Build Claude Code command from task options
   */
  private buildClaudeCommand(options: TaskOptions): string {
    const args = ['claude-code'];
    
    // Add the task
    args.push(`"${options.task}"`);
    
    // Add options
    if (options.timeout) {
      args.push('--timeout', options.timeout.toString());
    }
    
    if (options.autoCommit) {
      args.push('--auto-commit');
    }
    
    if (options.pullRequest) {
      args.push('--pull-request');
    }
    
    return args.join(' ');
  }

  /**
   * Clean up a codespace after task completion
   */
  async cleanupCodespace(taskId: string, deleteCodespace = true): Promise<void> {
    const codespace = this.activeCodespaces.get(taskId);
    if (!codespace) {
      console.log(chalk.yellow('⚠️  No active codespace found for task:', taskId));
      return;
    }

    try {
      if (deleteCodespace) {
        console.log(chalk.blue('🗑️  Deleting codespace...'));
        await this.api.deleteCodespace(codespace.name);
        console.log(chalk.green('✅ Codespace deleted'));
      } else {
        console.log(chalk.blue('⏸️  Stopping codespace...'));
        await this.api.stopCodespace(codespace.name);
        console.log(chalk.green('✅ Codespace stopped'));
      }
      
      this.activeCodespaces.delete(taskId);
      this.emit('codespace:cleaned', { taskId, codespace });
    } catch (error) {
      console.error(chalk.red('❌ Failed to cleanup codespace:'), error.message);
      this.emit('codespace:error', { taskId, error });
    }
  }

  /**
   * List all active codespaces managed by this instance
   */
  async listActiveCodespaces(): Promise<Codespace[]> {
    try {
      const allCodespaces = await this.api.listCodespaces();
      
      // Filter to only show codespaces created by rcli
      const rcliCodespaces = allCodespaces.filter(cs => 
        cs.display_name?.startsWith('rcli-')
      );
      
      return rcliCodespaces;
    } catch (error) {
      console.error(chalk.red('❌ Failed to list codespaces:'), error.message);
      throw error;
    }
  }

  /**
   * Get a specific codespace by task ID
   */
  getCodespaceForTask(taskId: string): Codespace | undefined {
    return this.activeCodespaces.get(taskId);
  }

  /**
   * Run a complete task lifecycle
   */
  async runTask(taskId: string, options: TaskOptions): Promise<void> {
    let codespace: Codespace | undefined;
    
    try {
      // Create codespace
      codespace = await this.createCodespaceForTask(taskId, options);
      
      // Execute task
      await this.executeTask(taskId, codespace, options);
      
      // Cleanup (keep codespace if we need to create PR)
      await this.cleanupCodespace(taskId, !options.pullRequest);
      
    } catch (error) {
      // Ensure cleanup on error
      if (codespace) {
        await this.cleanupCodespace(taskId, true);
      }
      throw error;
    }
  }
}