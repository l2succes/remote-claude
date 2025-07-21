import axios, { AxiosInstance } from 'axios';

export interface CodespaceOptions {
  repository: string; // owner/repo format
  branch?: string | undefined;
  machine?: string | undefined;
  location?: string | undefined;
  displayName?: string | undefined;
  idleTimeoutMinutes?: number | undefined;
  retentionPeriodMinutes?: number | undefined;
}

export interface Codespace {
  id: number;
  name: string;
  owner: {
    login: string;
  };
  repository: {
    full_name: string;
  };
  machine: {
    name: string;
    display_name: string;
  };
  state: 'Unknown' | 'Created' | 'Queued' | 'Provisioning' | 'Available' | 'Awaiting' | 'Unavailable' | 'Deleted' | 'Moved' | 'Shutdown' | 'Archived' | 'Starting' | 'ShuttingDown' | 'Failed' | 'Exporting' | 'Updating' | 'Rebuilding';
  git_status: {
    ahead: number;
    behind: number;
    has_uncommitted_changes: boolean;
    has_unpushed_changes: boolean;
  };
  web_url: string;
  created_at: string;
  updated_at: string;
  last_used_at: string;
  idle_timeout_minutes: number;
  retention_period_minutes?: number;
}

export class GitHubAPI {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  }

  /**
   * Check if GitHub CLI is available
   */
  async checkGitHubCLI(): Promise<boolean> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('gh --version', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all codespaces for the authenticated user
   */
  async listCodespaces(): Promise<Codespace[]> {
    try {
      const response = await this.client.get('/user/codespaces');
      return response.data.codespaces;
    } catch (error) {
      throw new Error(`Failed to list codespaces: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new codespace
   */
  async createCodespace(options: CodespaceOptions): Promise<Codespace> {
    try {
      const [owner, repo] = options.repository.split('/');
      
      const payload: any = {
        ref: options.branch,
        machine: options.machine || 'basicLinux32gb',
        location: options.location,
        display_name: options.displayName,
        idle_timeout_minutes: options.idleTimeoutMinutes || 30,
      };

      if (options.retentionPeriodMinutes !== undefined) {
        payload.retention_period_minutes = options.retentionPeriodMinutes;
      }

      const response = await this.client.post(
        `/repos/${owner}/${repo}/codespaces`,
        payload
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create codespace: ${(error as Error).message}`);
    }
  }

  /**
   * Get a specific codespace
   */
  async getCodespace(name: string): Promise<Codespace> {
    try {
      const response = await this.client.get(`/user/codespaces/${name}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get codespace: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a codespace
   */
  async deleteCodespace(name: string): Promise<void> {
    try {
      await this.client.delete(`/user/codespaces/${name}`);
    } catch (error) {
      throw new Error(`Failed to delete codespace: ${(error as Error).message}`);
    }
  }

  /**
   * Start a stopped codespace
   */
  async startCodespace(name: string): Promise<Codespace> {
    try {
      const response = await this.client.post(`/user/codespaces/${name}/start`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start codespace: ${(error as Error).message}`);
    }
  }

  /**
   * Stop a running codespace
   */
  async stopCodespace(name: string): Promise<Codespace> {
    try {
      const response = await this.client.post(`/user/codespaces/${name}/stop`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to stop codespace: ${(error as Error).message}`);
    }
  }

  /**
   * Get the connection details for a codespace (for SSH/VS Code)
   */
  async getCodespaceConnection(name: string): Promise<any> {
    try {
      const response = await this.client.get(`/user/codespaces/${name}/exports`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get codespace connection: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a command in a codespace via the GitHub CLI API
   * Note: This requires the GitHub CLI to be installed and authenticated
   */
  async executeCommand(name: string, command: string): Promise<string> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // Use GitHub CLI to execute command in codespace
      const ghCommand = `gh codespace ssh --codespace ${name} -- '${command.replace(/'/g, "'\\''")}' 2>&1`;
      
      const { stdout, stderr } = await execAsync(ghCommand, {
        timeout: 60000, // 1 minute timeout for individual commands
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      if (stderr && !stdout) {
        throw new Error(`Command failed: ${stderr}`);
      }

      return stdout + (stderr ? `\nStderr: ${stderr}` : '');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('GitHub CLI (gh) is not installed or not in PATH. Please install it from https://cli.github.com/');
      }
      
      if (error.killed) {
        throw new Error(`Command timed out: ${command}`);
      }
      
      throw new Error(`Failed to execute command in codespace: ${error.message}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get repository: ${(error as Error).message}`);
    }
  }

  /**
   * Get the default branch for a repository
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const repoData = await this.getRepository(owner, repo);
      return repoData.default_branch;
    } catch (error) {
      throw new Error(`Failed to get default branch: ${(error as Error).message}`);
    }
  }
}