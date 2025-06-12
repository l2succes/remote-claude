import keytar from 'keytar';
import { ConfigManager } from './config';
import chalk from 'chalk';
import { execSync } from 'child_process';

const SERVICE_NAME = 'remote-claude-cli';
const ACCOUNT_NAME = 'github-token';

export class AuthManager {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Get GitHub token from keychain, config, or environment
   */
  async getGitHubToken(): Promise<string | null> {
    // Try environment variable first
    if (process.env.GITHUB_TOKEN) {
      return process.env.GITHUB_TOKEN;
    }

    // Try keychain
    try {
      const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (token) {
        return token;
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Keychain access failed:'), (error as Error).message);
    }

    // Try config file
    const configToken = this.configManager.getGitHubToken();
    if (configToken) {
      return configToken;
    }

    // Try GitHub CLI if available
    try {
      const ghToken = this.getGitHubCliToken();
      if (ghToken) {
        console.log(chalk.blue('ℹ️  Using token from GitHub CLI'));
        return ghToken;
      }
    } catch (error) {
      // GitHub CLI not available or not authenticated
    }

    return null;
  }

  /**
   * Store GitHub token securely in keychain
   */
  async setGitHubToken(token: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
      console.log(chalk.green('✅ GitHub token stored securely in keychain'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to store in keychain, saving to config file instead'));
      await this.configManager.configureGitHub({ token });
    }
  }

  /**
   * Remove GitHub token from keychain
   */
  async removeGitHubToken(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      console.log(chalk.green('✅ GitHub token removed from keychain'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to remove from keychain:'), (error as Error).message);
    }

    // Also remove from config
    this.configManager.set('github.token', undefined);
    await this.configManager.saveConfig();
  }

  /**
   * Check if authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getGitHubToken();
    return !!token;
  }

  /**
   * Get token from GitHub CLI if available
   */
  private getGitHubCliToken(): string | null {
    try {
      const token = execSync('gh auth token', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      return token || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate GitHub token by making a test API call
   */
  async validateToken(token?: string): Promise<boolean> {
    const tokenToValidate = token || await this.getGitHubToken();
    if (!tokenToValidate) {
      return false;
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenToValidate}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const user = await response.json() as any;
        console.log(chalk.green('✅ Authenticated as:'), user.login);
        return true;
      } else {
        console.error(chalk.red('❌ Invalid GitHub token'));
        return false;
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to validate token:'), (error as Error).message);
      return false;
    }
  }

  /**
   * Interactive token setup
   */
  async setupInteractive(): Promise<void> {
    console.log(chalk.blue('🔐 GitHub Authentication Setup'));
    console.log(chalk.gray('─'.repeat(40)));
    
    console.log(chalk.yellow('\nTo use this CLI, you need a GitHub personal access token with the following scopes:'));
    console.log(chalk.gray('  • codespace'));
    console.log(chalk.gray('  • repo (if you want to create PRs)'));
    console.log(chalk.gray('  • read:user'));
    
    console.log(chalk.yellow('\nYou can create a token at:'));
    console.log(chalk.blue('https://github.com/settings/tokens/new'));
    
    console.log(chalk.yellow('\nOnce you have a token, run:'));
    console.log(chalk.green('  rcli config github --token YOUR_TOKEN'));
    
    console.log(chalk.gray('─'.repeat(40)));
  }

  /**
   * Get authentication status info
   */
  async getAuthStatus(): Promise<{
    authenticated: boolean;
    source?: string;
    username?: string;
  }> {
    const token = await this.getGitHubToken();
    if (!token) {
      return { authenticated: false };
    }

    let source = 'unknown';
    if (process.env.GITHUB_TOKEN) {
      source = 'environment';
    } else {
      try {
        const keychainToken = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        if (keychainToken === token) {
          source = 'keychain';
        } else if (this.configManager.getGitHubToken() === token) {
          source = 'config';
        } else {
          source = 'github-cli';
        }
      } catch {
        source = 'config';
      }
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const user = await response.json() as any;
        return {
          authenticated: true,
          source,
          username: user.login,
        };
      }
    } catch (error) {
      // Token exists but validation failed
    }

    return {
      authenticated: true,
      source,
    };
  }
}