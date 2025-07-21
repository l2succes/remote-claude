import { execSync } from 'child_process';

export function getCurrentGitRepository(): string | null {
  try {
    // Get the remote origin URL
    const remoteUrl = execSync('git config --get remote.origin.url', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    if (!remoteUrl) {
      return null;
    }
    
    // Parse GitHub repository from various URL formats
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    // https://github.com/owner/repo
    
    let match;
    
    // SSH format
    if (remoteUrl.startsWith('git@github.com:')) {
      match = remoteUrl.match(/git@github\.com:([^\/]+\/[^\.]+)(\.git)?$/);
    } 
    // HTTPS format
    else if (remoteUrl.includes('github.com')) {
      match = remoteUrl.match(/github\.com[\/:]([^\/]+\/[^\.]+?)(\.git)?$/);
    }
    
    if (match && match[1]) {
      return match[1];
    }
    
    return null;
  } catch (error) {
    // Not a git repository or git not available
    return null;
  }
}

export function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}