import { GitHubAPI, Codespace, CodespaceOptions } from './github-api';
import { EventEmitter } from 'events';
import chalk from 'chalk';

export interface TaskOptions {
  task: string;
  repository: string;
  branch?: string | undefined;
  timeout?: number | undefined;
  autoCommit?: boolean | undefined;
  pullRequest?: boolean | undefined;
  outputFiles?: string[] | undefined;
}

export interface CodespaceManagerOptions {
  token: string;
  webhookUrl?: string | undefined;
  defaultMachine?: string | undefined;
  defaultLocation?: string | undefined;
  defaultIdleTimeout?: number | undefined;
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
   * Check if GitHub CLI is available for remote execution
   */
  async checkPrerequisites(): Promise<void> {
    const hasGitHubCLI = await this.api.checkGitHubCLI();
    if (!hasGitHubCLI) {
      throw new Error('GitHub CLI (gh) is required for remote execution. Please install it from https://cli.github.com/');
    }
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
      console.error(chalk.red('❌ Failed to create codespace:'), (error as Error).message);
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
      
      this.emit('task:started', { taskId, codespace, command });
      
      // Send start notification via webhook
      await this.api.executeCommand(codespace.name, `/tmp/webhook.sh "running" "Task started: ${taskOptions.task}"`);
      
      try {
        // Execute the actual Claude Code command
        const result = await this.api.executeCommand(codespace.name, command);
        
        console.log(chalk.green('✅ Task completed successfully'));
        console.log(chalk.gray('Output:'), result.substring(0, 500) + (result.length > 500 ? '...' : ''));
        
        // Send completion notification via webhook
        await this.api.executeCommand(codespace.name, `/tmp/webhook.sh "completed" "Task completed successfully"`);
        
        this.emit('task:completed', { taskId, codespace, result });
        
      } catch (commandError) {
        console.error(chalk.red('❌ Command execution failed:'), (commandError as Error).message);
        
        // Send failure notification via webhook
        await this.api.executeCommand(codespace.name, `/tmp/webhook.sh "failed" "Task failed: ${(commandError as Error).message}"`);
        
        this.emit('task:failed', { taskId, codespace, error: commandError });
        throw commandError;
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Task execution failed:'), (error as Error).message);
      this.emit('task:failed', { taskId, codespace, error });
      throw error;
    }
  }

  /**
   * Install Claude Code in the codespace
   */
  async installClaudeCode(codespaceName: string): Promise<void> {
    console.log(chalk.gray('📦 Installing Claude Code...'));
    
    try {
      // Install Claude Code via npm
      const installCommand = 'npm install -g @anthropic-ai/claude-code-cli';
      const result = await this.api.executeCommand(codespaceName, installCommand);
      
      console.log(chalk.green('✅ Claude Code installed successfully'));
      console.log(chalk.gray('Installation output:'), result.substring(0, 200) + (result.length > 200 ? '...' : ''));
      
      // Verify installation
      const verifyCommand = 'claude-code --version';
      await this.api.executeCommand(codespaceName, verifyCommand);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to install Claude Code:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Setup persistent session environment with auto-configuration
   */
  async setupPersistentSession(codespaceName: string): Promise<void> {
    console.log(chalk.gray('🔧 Setting up persistent session environment...'));
    
    try {
      // Get the setup script content
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const scriptPath = path.join(__dirname, '../../scripts/setup-persistent-session.sh');
      const scriptContent = await fs.readFile(scriptPath, 'utf-8');
      
      // Upload and execute the setup script
      const uploadCommand = `cat > /tmp/setup-persistent.sh << 'SCRIPT_EOF'
${scriptContent}
SCRIPT_EOF
chmod +x /tmp/setup-persistent.sh`;
      
      await this.api.executeCommand(codespaceName, uploadCommand);
      
      console.log(chalk.blue('🚀 Running persistent session setup...'));
      const setupResult = await this.api.executeCommand(codespaceName, 'bash /tmp/setup-persistent.sh');
      
      console.log(chalk.green('✅ Persistent session setup completed'));
      console.log(chalk.gray('Setup output:'), setupResult.substring(0, 300) + (setupResult.length > 300 ? '...' : ''));
      
      // Clean up the script
      await this.api.executeCommand(codespaceName, 'rm -f /tmp/setup-persistent.sh');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup persistent session:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Set up webhook for status updates
   */
  private async setupWebhook(codespaceName: string, taskId: string): Promise<void> {
    if (!this.options.webhookUrl) return;
    
    console.log(chalk.gray('🔔 Setting up webhook...'));
    
    try {
      // Create a script to send webhook updates
      const webhookScript = `
#!/bin/bash
WEBHOOK_URL="${this.options.webhookUrl}/webhook/${taskId}"
STATUS="$1"
MESSAGE="$2"

curl -X POST "$WEBHOOK_URL" \\
  -H "Content-Type: application/json" \\
  -d "{\\"status\\": \\"$STATUS\\", \\"message\\": \\"$MESSAGE\\", \\"timestamp\\": \\"$(date -Iseconds)\\"}" \\
  --silent --max-time 10 || true
      `.trim();

      // Write the webhook script to the codespace
      const writeScriptCommand = `cat > /tmp/webhook.sh << 'EOF'
${webhookScript}
EOF
chmod +x /tmp/webhook.sh`;

      await this.api.executeCommand(codespaceName, writeScriptCommand);
      
      console.log(chalk.green('✅ Webhook setup completed'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup webhook:'), (error as Error).message);
    }
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
      console.error(chalk.red('❌ Failed to cleanup codespace:'), (error as Error).message);
      this.emit('codespace:error', { taskId, error });
    }
  }

  /**
   * Clean up a codespace by name
   */
  async cleanupCodespaceByName(codespaceName: string, deleteCodespace = true): Promise<void> {
    try {
      if (deleteCodespace) {
        console.log(chalk.blue('🗑️  Deleting codespace...'));
        await this.api.deleteCodespace(codespaceName);
        console.log(chalk.green('✅ Codespace deleted'));
      } else {
        console.log(chalk.blue('⏸️  Stopping codespace...'));
        await this.api.stopCodespace(codespaceName);
        console.log(chalk.green('✅ Codespace stopped'));
      }
      
      this.emit('codespace:cleaned', { codespaceName });
    } catch (error) {
      console.error(chalk.red('❌ Failed to cleanup codespace:'), (error as Error).message);
      this.emit('codespace:error', { codespaceName, error });
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
        cs.name?.startsWith('rcli-')
      );
      
      return rcliCodespaces;
    } catch (error) {
      console.error(chalk.red('❌ Failed to list codespaces:'), (error as Error).message);
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
      // Check prerequisites
      await this.checkPrerequisites();
      
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