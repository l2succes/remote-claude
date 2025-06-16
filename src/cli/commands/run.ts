import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config';
import { AuthManager } from '../utils/auth';
import { TaskManager } from '../../tasks/manager';
import { TaskPriority } from '../../tasks/types';

export interface RunOptions {
  repo?: string;
  branch?: string;
  timeout?: string;
  priority?: string;
  notify?: string;
  notifyOnStart?: boolean;
  notifyOnComplete?: boolean;
  notifyOnFail?: boolean;
  autoCommit?: boolean;
  pullRequest?: boolean;
  output?: string;
  name?: string;
  interactive?: boolean;
  persistent?: boolean;
}

export async function runCommand(task: string, options: RunOptions): Promise<void> {
  try {
    console.log(chalk.blue('🚀 Starting remote Claude Code task...'));
    console.log(chalk.gray(`Task: ${task}`));
    
    // Initialize managers
    const configManager = new ConfigManager();
    const authManager = new AuthManager(configManager);
    
    // Check authentication
    const token = await authManager.getGitHubToken();
    if (!token) {
      console.error(chalk.red('❌ Not authenticated'));
      console.log(chalk.yellow('Run'), chalk.blue('rclaude config github'), chalk.yellow('to set up authentication'));
      process.exit(1);
    }
    
    // Get repository
    const repository = options.repo || configManager.getDefaultRepository();
    if (!repository) {
      console.error(chalk.red('❌ No repository specified'));
      console.log(chalk.yellow('Use'), chalk.blue('--repo owner/repo'), chalk.yellow('or set a default with'), chalk.blue('rclaude config github --repository owner/repo'));
      process.exit(1);
    }
    
    console.log(chalk.gray(`Repository: ${repository}`));
    if (options.branch) {
      console.log(chalk.gray(`Branch: ${options.branch}`));
    }
    console.log(chalk.gray(`Timeout: ${options.timeout}s`));
    
    // Parse priority
    const priority = (options.priority as TaskPriority) || 'normal';
    console.log(chalk.gray(`Priority: ${priority}`));
    
    if (options.interactive) {
      // Interactive mode - create codespace and connect directly
      console.log(chalk.blue('🖥️  Starting interactive Claude Code session...'));
      
      const { CodespaceManager } = await import('../../codespace/manager');
      const codespaceManager = new CodespaceManager({
        token,
        webhookUrl: undefined, // No webhook needed for interactive
      });
      
      await codespaceManager.checkPrerequisites();
      
      // Create codespace for interactive session
      const taskId = `interactive-${Date.now()}`;
      const codespace = await codespaceManager.createCodespaceForTask(taskId, {
        task,
        repository,
        branch: options.branch,
        timeout: parseInt(options.timeout || '7200', 10),
        autoCommit: options.autoCommit,
        pullRequest: options.pullRequest,
        outputFiles: options.output?.split(','),
      });
      
      // Install Claude Code
      await codespaceManager.installClaudeCode(codespace.name);
      
      // Setup persistent session environment if requested or if interactive
      if (options.persistent !== false) {
        await codespaceManager.setupPersistentSession(codespace.name);
      }
      
      console.log(chalk.green('✅ Interactive session ready!'));
      console.log(chalk.blue('🔗 Connecting to codespace...'));
      
      if (options.persistent !== false) {
        console.log(chalk.gray('💡 Auto-setup: tmux session will be created'));
        console.log(chalk.gray('💡 Use Ctrl+B then D to detach and keep running'));
        console.log(chalk.gray('💡 Reconnect with: tmux attach-session -t claude-work'));
      }
      
      // Connect interactively via GitHub CLI
      const { spawn } = require('child_process');
      
      // Choose connection command based on persistent option
      const connectArgs = options.persistent !== false 
        ? ['codespace', 'ssh', '--codespace', codespace.name, '--', '~/start-claude.sh']
        : ['codespace', 'ssh', '--codespace', codespace.name, '--', 'claude-code'];
      
      const interactiveProcess = spawn('gh', connectArgs, {
        stdio: 'inherit', // Pass through stdin/stdout/stderr
      });
      
      // Handle process exit
      interactiveProcess.on('exit', async (code: number) => {
        console.log(chalk.yellow('\n📤 Interactive session ended'));
        
        if (options.autoCommit || options.pullRequest) {
          console.log(chalk.blue('🔄 Processing changes...'));
          // Note: Auto-commit logic would be handled here
        }
        
        // Ask user if they want to keep the codespace
        const inquirer = await import('inquirer');
        const { keepCodespace } = await inquirer.default.prompt([{
          type: 'confirm',
          name: 'keepCodespace',
          message: 'Keep the codespace running?',
          default: false,
        }]);
        
        if (!keepCodespace) {
          console.log(chalk.blue('🗑️  Cleaning up codespace...'));
          await codespaceManager.cleanupCodespace(taskId, true);
        } else {
          console.log(chalk.green('✅ Codespace kept running:'), codespace.name);
          console.log(chalk.gray('Access it later with:'), chalk.blue(`gh codespace ssh --codespace ${codespace.name}`));
        }
        
        process.exit(code);
      });
      
      return; // Exit early for interactive mode
    }
    
    // Non-interactive mode - use task queue
    const taskManager = new TaskManager({
      token,
      autoStart: false,
    });
    
    await taskManager.start();
    
    // Create task
    const taskId = await taskManager.createTask({
      name: options.name || task,
      command: task,
      repository,
      branch: options.branch,
      priority,
      timeout: parseInt(options.timeout || '7200', 10),
      autoCommit: options.autoCommit,
      pullRequest: options.pullRequest,
      outputFiles: options.output?.split(','),
      notifications: {
        channels: options.notify?.split(','),
        onStart: options.notifyOnStart,
        onComplete: options.notifyOnComplete,
        onFail: options.notifyOnFail,
      },
    });
    
    console.log(chalk.green('✅ Task created and queued:'), chalk.gray(`ID: ${taskId}`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude status`), chalk.gray(`to check task status`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude results ${taskId}`), chalk.gray(`to download results when complete`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude logs ${taskId}`), chalk.gray(`to view execution logs`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude cancel ${taskId}`), chalk.gray(`to cancel the task`));
    
    await taskManager.stop();
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createRunCommand(): Command {
  const command = new Command('run');
  
  return command
    .description('Execute a Claude Code task remotely')
    .argument('<task>', 'The task to execute')
    .option('-r, --repo <repository>', 'GitHub repository (owner/repo)')
    .option('-b, --branch <branch>', 'Git branch to use')
    .option('-t, --timeout <seconds>', 'Task timeout in seconds', '7200')
    .option('-p, --priority <level>', 'Task priority (low, normal, high, urgent)', 'normal')
    .option('-i, --interactive', 'Run in interactive mode (connects directly to codespace)')
    .option('--persistent', 'Enable persistent session with tmux (default for interactive)')
    .option('--no-persistent', 'Disable persistent session setup')
    .option('-n, --notify <channels>', 'Notification channels (comma-separated)')
    .option('--notify-on-start', 'Send notification when task starts')
    .option('--notify-on-complete', 'Send notification when task completes')
    .option('--notify-on-fail', 'Send notification when task fails')
    .option('--auto-commit', 'Automatically commit changes')
    .option('--pull-request', 'Create pull request for changes')
    .option('-o, --output <files>', 'Expected output files (comma-separated)')
    .option('--name <name>', 'Custom name for the task')
    .action(runCommand);
}