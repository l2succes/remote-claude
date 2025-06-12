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
    await configManager.configureGitHub({
      username: options.username,
      repository: options.repository,
    });
    
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
      return;
    }
    
    // Configure notifications
    await configManager.configureNotifications(options);
    
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