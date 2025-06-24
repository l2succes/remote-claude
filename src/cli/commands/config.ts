import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config';
import { AuthManager } from '../utils/auth';

export interface GitHubConfigOptions {
  token?: string;
  username?: string;
  repository?: string;
}

export interface NotifyConfigOptions {
  email?: string;
  slack?: string;
  pushover?: string;
  webhook?: string;
}

export interface EC2ConfigOptions {
  region?: string;
  instanceType?: string;
  keyPair?: string;
  securityGroup?: string;
  subnet?: string;
  spotInstance?: boolean;
  idleTimeout?: number;
}

export async function githubConfigCommand(options: GitHubConfigOptions): Promise<void> {
  try {
    console.log(chalk.blue('🔧 Configuring GitHub access...'));
    
    const configManager = new ConfigManager();
    const authManager = new AuthManager(configManager);
    
    // If no options provided, show current configuration
    if (!options.token && !options.username && !options.repository) {
      const authStatus = await authManager.getAuthStatus();
      
      console.log(chalk.gray('─'.repeat(40)));
      if (authStatus.authenticated) {
        console.log(chalk.green('✅ Authenticated'));
        console.log(chalk.gray(`Source: ${authStatus.source}`));
        if (authStatus.username) {
          console.log(chalk.gray(`Username: ${authStatus.username}`));
        }
      } else {
        console.log(chalk.red('❌ Not authenticated'));
        await authManager.setupInteractive();
      }
      
      const defaultRepo = configManager.getDefaultRepository();
      if (defaultRepo) {
        console.log(chalk.gray(`Default repository: ${defaultRepo}`));
      }
      console.log(chalk.gray('─'.repeat(40)));
      return;
    }
    
    // Set token if provided
    if (options.token) {
      console.log(chalk.gray('Validating GitHub token...'));
      const isValid = await authManager.validateToken(options.token);
      
      if (isValid) {
        await authManager.setGitHubToken(options.token);
      } else {
        throw new Error('Invalid GitHub token');
      }
    }
    
    // Configure other options
    if (options.username || options.repository) {
      await configManager.configureGitHub({
        ...(options.username && { username: options.username }),
        ...(options.repository && { repository: options.repository }),
      });
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export async function notifyConfigCommand(options: NotifyConfigOptions): Promise<void> {
  try {
    console.log(chalk.blue('🔔 Configuring notifications...'));
    
    const configManager = new ConfigManager();
    
    // If no options provided, show current configuration
    if (!options.email && !options.slack && !options.pushover && !options.webhook) {
      configManager.displayConfig();
      console.log(chalk.gray('\nTo configure notifications:'));
      console.log(chalk.blue('  rclaude config notify --email your@email.com'));
      console.log(chalk.blue('  rclaude config notify --slack https://hooks.slack.com/...'));
      console.log(chalk.blue('  rclaude config notify --webhook https://your-webhook.com/endpoint'));
      console.log(chalk.blue('  rclaude config notify --pushover app-token:user-key'));
      return;
    }
    
    // Configure notifications
    await configManager.configureNotifications(options);
    
    console.log(chalk.green('✨ Notification configuration updated!'));
    console.log(chalk.gray('Use'), chalk.blue('--notify-on-start, --notify-on-complete, --notify-on-fail'), chalk.gray('flags with the run command'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export async function ec2ConfigCommand(options: EC2ConfigOptions): Promise<void> {
  try {
    console.log(chalk.blue('🔧 Configuring EC2 settings...'));
    
    const configManager = new ConfigManager();
    
    // If no options provided, show current configuration
    if (!options.region && !options.instanceType && !options.keyPair && 
        !options.securityGroup && !options.subnet && !options.idleTimeout &&
        options.spotInstance === undefined) {
      
      const currentConfig = configManager.get('ec2') as any || {};
      
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.bold('Current EC2 Configuration:'));
      console.log(chalk.gray(`Region: ${currentConfig.region || 'not set'}`));
      console.log(chalk.gray(`Instance Type: ${currentConfig.instanceType || 'not set'}`));
      console.log(chalk.gray(`Key Pair: ${currentConfig.keyPair || 'not set'}`));
      console.log(chalk.gray(`Security Group: ${currentConfig.securityGroupIds?.[0] || 'not set'}`));
      console.log(chalk.gray(`Subnet: ${currentConfig.subnetId || 'not set'}`));
      console.log(chalk.gray(`Spot Instances: ${currentConfig.spotInstance ? 'enabled' : 'disabled'}`));
      console.log(chalk.gray(`Idle Timeout: ${currentConfig.idleTimeout || 60} minutes`));
      console.log(chalk.gray('─'.repeat(40)));
      
      if (!currentConfig.region || !currentConfig.keyPair) {
        console.log(chalk.yellow('\n⚠️  Minimum required configuration:'));
        console.log(chalk.blue('  rclaude config ec2 --region us-east-1 --key-pair your-key-name'));
      }
      
      console.log(chalk.gray('\nTo modify settings:'));
      console.log(chalk.blue('  rclaude config ec2 --region us-west-2'));
      console.log(chalk.blue('  rclaude config ec2 --instance-type t3.medium'));
      console.log(chalk.blue('  rclaude config ec2 --key-pair my-key'));
      console.log(chalk.blue('  rclaude config ec2 --spot-instance'));
      
      return;
    }
    
    // Get existing config
    const existingConfig = configManager.get('ec2') as any || {};
    
    // Update configuration
    const updatedConfig = {
      ...existingConfig,
      ...(options.region && { region: options.region }),
      ...(options.instanceType && { instanceType: options.instanceType }),
      ...(options.keyPair && { keyPair: options.keyPair }),
      ...(options.securityGroup && { securityGroupIds: [options.securityGroup] }),
      ...(options.subnet && { subnetId: options.subnet }),
      ...(options.spotInstance !== undefined && { spotInstance: options.spotInstance }),
      ...(options.idleTimeout && { idleTimeout: options.idleTimeout }),
      autoTerminate: true, // Always enable auto-termination for safety
      tags: {
        Project: 'remote-claude',
        ...existingConfig.tags
      }
    };
    
    configManager.set('ec2', updatedConfig);
    await configManager.saveConfig();
    
    console.log(chalk.green('✅ EC2 configuration updated!'));
    
    // Show what was updated
    const changes = [];
    if (options.region) changes.push(`Region: ${options.region}`);
    if (options.instanceType) changes.push(`Instance Type: ${options.instanceType}`);
    if (options.keyPair) changes.push(`Key Pair: ${options.keyPair}`);
    if (options.securityGroup) changes.push(`Security Group: ${options.securityGroup}`);
    if (options.subnet) changes.push(`Subnet: ${options.subnet}`);
    if (options.spotInstance !== undefined) changes.push(`Spot Instances: ${options.spotInstance ? 'enabled' : 'disabled'}`);
    if (options.idleTimeout) changes.push(`Idle Timeout: ${options.idleTimeout} minutes`);
    
    if (changes.length > 0) {
      console.log(chalk.gray('Updated:'), changes.join(', '));
    }
    
    // Show usage example
    console.log(chalk.gray('\nUse EC2 provider:'));
    console.log(chalk.blue('  rclaude run "your task" --provider ec2'));
    
    if (updatedConfig.spotInstance) {
      console.log(chalk.gray('Spot instances enabled for cost savings (60-90% off)'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createConfigCommand(): Command {
  const command = new Command('config');
  
  command
    .description('Manage configuration');
  
  // GitHub subcommand
  command
    .command('github')
    .description('Configure GitHub access')
    .option('-t, --token <token>', 'GitHub personal access token')
    .option('-u, --username <username>', 'GitHub username')
    .option('-r, --repository <repo>', 'Default repository')
    .action(githubConfigCommand);
  
  // Notify subcommand
  command
    .command('notify')
    .description('Configure notifications')
    .option('-e, --email <email>', 'Email address for notifications')
    .option('-s, --slack <webhook>', 'Slack webhook URL')
    .option('-p, --pushover <config>', 'Pushover configuration (app-token:user-key)')
    .option('-w, --webhook <url>', 'Custom webhook URL')
    .action(notifyConfigCommand);
  
  // EC2 subcommand
  command
    .command('ec2')
    .description('Configure AWS EC2 settings')
    .option('-r, --region <region>', 'AWS region (e.g., us-east-1)')
    .option('-i, --instance-type <type>', 'EC2 instance type (e.g., t3.micro)')
    .option('-k, --key-pair <name>', 'SSH key pair name')
    .option('-s, --security-group <id>', 'Security group ID')
    .option('-n, --subnet <id>', 'Subnet ID')
    .option('--spot-instance', 'Enable spot instances for cost savings')
    .option('--no-spot-instance', 'Disable spot instances')
    .option('-t, --idle-timeout <minutes>', 'Idle timeout in minutes', (val) => parseInt(val))
    .action(ec2ConfigCommand);
  
  return command;
}