import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config';
import { AuthManager } from '../utils/auth';
import { TaskManager } from '../../tasks/manager';
import { TaskPriority } from '../../tasks/types';
import { ComputeProviderType, ComputeConfig } from '../../compute';
import { getCurrentGitRepository } from '../utils/git';

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
  idleTimeout?: number;
  machineType?: string;
  sessionId?: string;
  // Compute provider options
  provider?: string;
  ec2InstanceType?: string;
  ec2Spot?: boolean;
  ec2Region?: string;
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
    
    // Get repository - prioritize current git repo, then options, then config
    const currentRepo = getCurrentGitRepository();
    const repository = options.repo || currentRepo || configManager.getDefaultRepository();
    
    if (!repository) {
      console.error(chalk.red('❌ No repository specified'));
      console.log(chalk.yellow('Use'), chalk.blue('--repo owner/repo'), chalk.yellow('or run from a GitHub repository'));
      console.log(chalk.yellow('You can also set a default with'), chalk.blue('rclaude config github --repository owner/repo'));
      process.exit(1);
    }
    
    if (currentRepo && !options.repo) {
      console.log(chalk.gray(`Using current repository: ${repository}`));
    }
    
    console.log(chalk.gray(`Repository: ${repository}`));
    if (options.branch) {
      console.log(chalk.gray(`Branch: ${options.branch}`));
    }
    console.log(chalk.gray(`Timeout: ${options.timeout}s`));
    
    // Parse priority
    const priority = (options.priority as TaskPriority) || 'normal';
    console.log(chalk.gray(`Priority: ${priority}`));
    
    // Validate and show codespace configuration
    if (options.idleTimeout) {
      if (options.idleTimeout < 30 || options.idleTimeout > 1440) {
        console.error(chalk.red('❌ Idle timeout must be between 30 and 1440 minutes (24 hours)'));
        process.exit(1);
      }
      console.log(chalk.gray(`Idle timeout: ${options.idleTimeout} minutes`));
    }
    if (options.machineType && options.machineType !== 'basicLinux32gb') {
      console.log(chalk.gray(`Machine type: ${options.machineType}`));
    }
    
    if (options.interactive) {
      // Interactive mode - create environment and connect directly
      console.log(chalk.blue('🖥️  Starting interactive Claude Code session...'));
      
      // Validate session ID if provided
      if (options.sessionId) {
        const sessionIdRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;
        if (!sessionIdRegex.test(options.sessionId)) {
          console.error(chalk.red('❌ Invalid session ID format'));
          console.log(chalk.yellow('Session ID must be alphanumeric with hyphens, no spaces, and cannot start/end with hyphen'));
          process.exit(1);
        }
        if (options.sessionId.length > 50) {
          console.error(chalk.red('❌ Session ID too long (max 50 characters)'));
          process.exit(1);
        }
      }
      
      // Build compute configuration for interactive session
      const computeConfig = buildComputeConfig(options, configManager);
      const taskId = options.sessionId || `interactive-${Date.now()}`;
      console.log(chalk.gray(`Session ID: ${taskId}`));
      
      if (computeConfig.provider === ComputeProviderType.EC2) {
        // EC2 Interactive mode
        const { EC2Provider } = await import('../../compute');
        const provider = new EC2Provider({
          ...computeConfig.ec2!,
          autoTerminate: false, // Keep running for interactive use
          idleTimeout: options.idleTimeout || 120, // 2 hours default for interactive
        });
        
        console.log(chalk.gray(`Provider: EC2`));
        console.log(chalk.gray(`Region: ${computeConfig.ec2!.region}`));
        console.log(chalk.gray(`Instance Type: ${computeConfig.ec2!.instanceType}`));
        
        // Create EC2 environment
        const environment = await provider.createEnvironment({
          name: taskId
        });
        
        console.log(chalk.green('✅ EC2 instance created!'));
        console.log(chalk.gray(`Instance ID: ${environment.id}`));
        console.log(chalk.gray(`Public IP: ${environment.metadata.publicIp}`));
        
        // Install Claude Code on the instance
        console.log(chalk.blue('📦 Installing Claude Code...'));
        await provider.executeTask(environment, {
          id: 'install-claude',
          command: 'sudo npm install -g @anthropic-ai/claude-code'
        });
        
        console.log(chalk.green('✅ Interactive session ready!'));
        console.log(chalk.blue('🔗 Connecting to EC2 instance...'));
        
        // Connect via SSH using our EC2 connect command
        const { spawn } = require('child_process');
        const connectArgs = ['dist/cli.js', 'ec2', 'connect', environment.id];
        
        const interactiveProcess = spawn('node', connectArgs, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        // Handle process exit
        interactiveProcess.on('exit', async (code: number) => {
          console.log(chalk.yellow('\n📤 Interactive session ended'));
          
          // Ask user if they want to keep the instance
          const inquirer = await import('inquirer');
          const { keepInstance } = await inquirer.default.prompt([{
            type: 'confirm',
            name: 'keepInstance',
            message: 'Keep the EC2 instance running?',
            default: false,
          }]);
          
          if (!keepInstance) {
            console.log(chalk.blue('🗑️  Terminating EC2 instance...'));
            await provider.destroyEnvironment(environment.id);
          } else {
            console.log(chalk.green('✅ Instance kept running:'), environment.id);
            console.log(chalk.gray('Access it later with:'), chalk.blue(`rclaude ec2 connect ${environment.id}`));
          }
          
          process.exit(code);
        });
        
      } else {
        // Codespace Interactive mode (existing logic)
        const { CodespaceManager } = await import('../../codespace/manager');
        const codespaceManager = new CodespaceManager({
          token,
          webhookUrl: undefined, // No webhook needed for interactive
          defaultMachine: options.machineType,
          defaultIdleTimeout: options.idleTimeout,
        });
        
        await codespaceManager.checkPrerequisites();
        
        const codespace = await codespaceManager.createCodespaceForTask(taskId, {
          task,
          repository,
          branch: options.branch,
          timeout: parseInt(options.timeout || '7200', 10),
          autoCommit: options.autoCommit,
          pullRequest: options.pullRequest,
          outputFiles: options.output?.split(','),
        });
        
        await codespaceManager.installClaudeCode(codespace.name);
        
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
        
        const { spawn } = require('child_process');
        const connectArgs = options.persistent !== false 
          ? ['codespace', 'ssh', '--codespace', codespace.name, '--', '-t', 'bash', '-c', 'if tmux has-session -t claude-work 2>/dev/null; then tmux send-keys -t claude-work:claude-code "claude" Enter && tmux attach-session -t claude-work; else claude; fi']
          : ['codespace', 'ssh', '--codespace', codespace.name, '--', '-t', 'claude'];
        
        const interactiveProcess = spawn('gh', connectArgs, {
          stdio: 'inherit',
        });
        
        interactiveProcess.on('exit', async (code: number) => {
          console.log(chalk.yellow('\n📤 Interactive session ended'));
          
          if (options.autoCommit || options.pullRequest) {
            console.log(chalk.blue('🔄 Processing changes...'));
          }
          
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
      }
      
      return; // Exit early for interactive mode
    }
    
    // Build compute configuration
    const computeConfig = buildComputeConfig(options, configManager);
    
    // Non-interactive mode - use task queue
    const taskManager = new TaskManager({
      token,
      autoStart: false,
      compute: computeConfig,
      // Legacy options for backward compatibility
      defaultMachine: options.machineType,
      defaultIdleTimeout: options.idleTimeout,
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

/**
 * Build compute configuration from CLI options and config
 */
function buildComputeConfig(options: RunOptions, configManager: ConfigManager): ComputeConfig {
  const provider = options.provider?.toLowerCase() as ComputeProviderType || ComputeProviderType.CODESPACE;

  switch (provider) {
    case ComputeProviderType.CODESPACE:
      return {
        provider: ComputeProviderType.CODESPACE,
        codespace: {
          defaultMachine: options.machineType || configManager.get('github.defaultMachine') || 'basicLinux32gb',
          defaultIdleTimeout: options.idleTimeout || configManager.get('github.defaultIdleTimeout') || 30,
          repository: configManager.getDefaultRepository(),
        }
      };

    case ComputeProviderType.EC2:
      return {
        provider: ComputeProviderType.EC2,
        ec2: {
          region: options.ec2Region || configManager.get('ec2.region') || 'us-east-1',
          instanceType: options.ec2InstanceType || configManager.get('ec2.instanceType') || 't3.medium',
          spotInstance: options.ec2Spot || configManager.get('ec2.spotInstance') || false,
          idleTimeout: options.idleTimeout || configManager.get('ec2.idleTimeout') || 60,
          autoTerminate: true,
          tags: {
            Project: 'remote-claude',
            Environment: 'task-execution'
          }
        }
      };

    default:
      throw new Error(`Unsupported provider: ${provider}`);
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
    .option('--session-id <id>', 'Custom session ID for interactive sessions (alphanumeric with hyphens)')
    .option('--persistent', 'Enable persistent session with tmux (default for interactive)')
    .option('--no-persistent', 'Disable persistent session setup')
    .option('--idle-timeout <minutes>', 'Codespace idle timeout in minutes (30-1440)', (val) => parseInt(val))
    .option('--machine-type <type>', 'Codespace machine type (basicLinux32gb, standardLinux32gb, premiumLinux)', 'basicLinux32gb')
    .option('--provider <type>', 'Compute provider (codespace, ec2)', 'codespace')
    .option('--ec2-instance-type <type>', 'EC2 instance type (t3.medium, c5.xlarge, etc.)')
    .option('--ec2-spot', 'Use EC2 spot instances for cost savings')
    .option('--ec2-region <region>', 'EC2 region (us-east-1, us-west-2, etc.)')
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