import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class GitService {
  /**
   * Clone a GitHub repository to a target path using a GitHub access token
   */
  async cloneRepository(
    repoUrl: string,
    targetPath: string,
    githubToken: string
  ): Promise<void> {
    try {
      // Ensure the parent directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Parse the repo URL and inject the token for authentication
      const urlWithToken = this.injectToken(repoUrl, githubToken);

      console.log(`Cloning repository to ${targetPath}...`);
      const { stdout, stderr } = await execAsync(
        `git clone ${urlWithToken} ${targetPath}`,
        {
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
        }
      );

      if (stderr) {
        console.log('Git clone stderr:', stderr);
      }
      console.log('Repository cloned successfully');
    } catch (error) {
      console.error('Error cloning repository:', error);
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Commit changes in a workspace
   */
  async commitChanges(
    workspacePath: string,
    message: string,
    authorName: string = 'Remote Claude',
    authorEmail: string = 'noreply@remoteclaude.com'
  ): Promise<void> {
    try {
      // Configure git user for this commit
      await execAsync(
        `git config user.name "${authorName}" && git config user.email "${authorEmail}"`,
        { cwd: workspacePath }
      );

      // Stage all changes
      await execAsync('git add -A', { cwd: workspacePath });

      // Check if there are changes to commit
      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: workspacePath,
      });

      if (!status.trim()) {
        console.log('No changes to commit');
        return;
      }

      // Commit
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: workspacePath,
      });

      console.log('Changes committed successfully');
    } catch (error) {
      console.error('Error committing changes:', error);
      throw new Error(`Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Push changes to the remote repository
   */
  async pushChanges(
    workspacePath: string,
    githubToken: string,
    branch: string = 'main'
  ): Promise<void> {
    try {
      // Get the remote URL
      const { stdout: remoteUrl } = await execAsync('git remote get-url origin', {
        cwd: workspacePath,
      });

      // Inject token into the URL
      const urlWithToken = this.injectToken(remoteUrl.trim(), githubToken);

      // Update the remote URL temporarily
      await execAsync(`git remote set-url origin ${urlWithToken}`, {
        cwd: workspacePath,
      });

      // Push changes
      console.log(`Pushing changes to ${branch}...`);
      await execAsync(`git push origin ${branch}`, {
        cwd: workspacePath,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });

      console.log('Changes pushed successfully');
    } catch (error) {
      console.error('Error pushing changes:', error);
      throw new Error(`Failed to push changes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Inject GitHub token into repository URL for authentication
   */
  private injectToken(repoUrl: string, token: string): string {
    // Handle both HTTPS and git:// URLs
    if (repoUrl.startsWith('https://')) {
      // https://github.com/user/repo.git -> https://token@github.com/user/repo.git
      return repoUrl.replace('https://', `https://${token}@`);
    } else if (repoUrl.startsWith('git@')) {
      // git@github.com:user/repo.git -> https://token@github.com/user/repo.git
      return repoUrl
        .replace('git@', `https://${token}@`)
        .replace('.com:', '.com/');
    }
    return repoUrl;
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(workspacePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: workspacePath,
      });
      return stdout.trim();
    } catch (error) {
      console.error('Error getting current branch:', error);
      throw new Error(`Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasUncommittedChanges(workspacePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: workspacePath,
      });
      return stdout.trim().length > 0;
    } catch (error) {
      console.error('Error checking for uncommitted changes:', error);
      return false;
    }
  }
}

export const gitService = new GitService();
