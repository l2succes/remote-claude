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
  
  return command;
}