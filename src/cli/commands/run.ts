import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config';
import { AuthManager } from '../utils/auth';
import { CodespaceManager, TaskOptions } from '../../codespace/manager';
import { v4 as uuidv4 } from 'uuid';

export interface RunOptions {
  repo?: string;
  branch?: string;
  timeout?: string;
  notify?: string;
  notifyOnStart?: boolean;
  notifyOnComplete?: boolean;
  notifyOnFail?: boolean;
  autoCommit?: boolean;
  pullRequest?: boolean;
  output?: string;
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
      console.log(chalk.yellow('Run'), chalk.blue('rcli config github'), chalk.yellow('to set up authentication'));
      process.exit(1);
    }
    
    // Get repository
    const repository = options.repo || configManager.getDefaultRepository();
    if (!repository) {
      console.error(chalk.red('❌ No repository specified'));
      console.log(chalk.yellow('Use'), chalk.blue('--repo owner/repo'), chalk.yellow('or set a default with'), chalk.blue('rcli config github --repository owner/repo'));
      process.exit(1);
    }
    
    console.log(chalk.gray(`Repository: ${repository}`));
    if (options.branch) {
      console.log(chalk.gray(`Branch: ${options.branch}`));
    }
    console.log(chalk.gray(`Timeout: ${options.timeout}s`));
    
    // Generate task ID
    const taskId = uuidv4().split('-')[0];
    console.log(chalk.gray(`Task ID: ${taskId}`));
    
    // Prepare task options
    const taskOptions: TaskOptions = {
      task,
      repository,
      branch: options.branch,
      timeout: parseInt(options.timeout || '7200', 10),
      autoCommit: options.autoCommit,
      pullRequest: options.pullRequest,
      outputFiles: options.output?.split(','),
    };
    
    // Initialize Codespace manager
    const webhookConfig = configManager.getWebhookConfig();
    const webhookUrl = `http://${webhookConfig.host}:${webhookConfig.port}/webhook/${taskId}`;
    
    const codespaceManager = new CodespaceManager({
      token,
      webhookUrl,
      defaultMachine: configManager.get<string>('defaults.machine'),
      defaultLocation: configManager.get<string>('defaults.location'),
      defaultIdleTimeout: configManager.get<number>('defaults.idleTimeout'),
    });
    
    // Set up event listeners
    codespaceManager.on('codespace:created', ({ codespace }) => {
      console.log(chalk.green('✅ Codespace created:'), codespace.name);
    });
    
    codespaceManager.on('task:started', ({ command }) => {
      console.log(chalk.blue('▶️  Task started'));
      console.log(chalk.gray('Command:'), command);
    });
    
    codespaceManager.on('task:completed', () => {
      console.log(chalk.green('✅ Task completed successfully'));
    });
    
    codespaceManager.on('task:failed', ({ error }) => {
      console.error(chalk.red('❌ Task failed:'), error.message);
    });
    
    // Run the task
    console.log(chalk.blue('🔄 Creating and running task in Codespace...'));
    await codespaceManager.runTask(taskId, taskOptions);
    
    console.log(chalk.green('✨ Done!'));
    console.log(chalk.gray(`Use`), chalk.blue(`rcli status`), chalk.gray(`to check task status`));
    console.log(chalk.gray(`Use`), chalk.blue(`rcli results ${taskId}`), chalk.gray(`to download results`));
    
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
    .option('-n, --notify <channels>', 'Notification channels (comma-separated)')
    .option('--notify-on-start', 'Send notification when task starts')
    .option('--notify-on-complete', 'Send notification when task completes')
    .option('--notify-on-fail', 'Send notification when task fails')
    .option('--auto-commit', 'Automatically commit changes')
    .option('--pull-request', 'Create pull request for changes')
    .option('-o, --output <files>', 'Expected output files (comma-separated)')
    .action(runCommand);
}