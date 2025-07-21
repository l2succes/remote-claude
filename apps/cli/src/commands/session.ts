import { Command } from 'commander';
import { chalk } from '@remote-claude/ui';
import { ConfigManager } from '@remote-claude/config';
import { AuthManager } from '../utils/auth';
import { CodespaceManager } from '@remote-claude/core';

export interface SessionOptions {
  list?: boolean;
  connect?: string;
  cleanup?: boolean;
  direct?: boolean;
}

export async function sessionCommand(options: SessionOptions): Promise<void> {
  try {
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
    
    const codespaceManager = new CodespaceManager({
      token,
      webhookUrl: undefined,
    });
    
    if (options.list) {
      await listSessions(codespaceManager);
    } else if (options.connect) {
      await connectToSession(options.connect, options.direct);
    } else if (options.cleanup) {
      await cleanupSessions(codespaceManager);
    } else {
      // Default: list sessions
      await listSessions(codespaceManager);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

async function listSessions(codespaceManager: CodespaceManager): Promise<void> {
  console.log(chalk.blue('📋 Active Codespace Sessions'));
  console.log(chalk.gray('─'.repeat(80)));
  
  const codespaces = await codespaceManager.listActiveCodespaces();
  
  if (codespaces.length === 0) {
    console.log(chalk.gray('No active sessions found'));
    console.log(chalk.gray('Use'), chalk.blue('rclaude run --interactive "task"'), chalk.gray('to start a new session'));
    return;
  }
  
  codespaces.forEach((codespace, index) => {
    const statusColor = codespace.state === 'Available' ? 'green' : 
                       codespace.state === 'Starting' ? 'yellow' : 'gray';
    
    console.log(`${index + 1}. ${chalk.white(codespace.name)}`);
    console.log(`   Repository: ${chalk.gray(codespace.repository.full_name)}`);
    console.log(`   Status: ${chalk[statusColor](codespace.state)}`);
    console.log(`   Machine: ${chalk.gray(codespace.machine.display_name)}`);
    console.log(`   Created: ${chalk.gray(new Date(codespace.created_at).toLocaleString())}`);
    console.log(`   Last used: ${chalk.gray(new Date(codespace.last_used_at).toLocaleString())}`);
    console.log(`   Connect: ${chalk.blue(`rclaude session --connect ${codespace.name}`)}`);
    console.log();
  });
  
  console.log(chalk.gray('Commands:'));
  console.log(chalk.blue('  rclaude session --connect <name>'), chalk.gray('- Connect to a session'));
  console.log(chalk.blue('  rclaude session --cleanup'), chalk.gray('- Clean up old sessions'));
}

async function connectToSession(codespaceName: string, direct?: boolean): Promise<void> {
  console.log(chalk.blue('🔗 Connecting to session:'), codespaceName);
  
  const { spawn, execSync } = require('child_process');
  
  let connectArgs;
  
  if (direct) {
    console.log(chalk.gray('Direct connection mode - bypassing tmux'));
    connectArgs = [
      'codespace', 'ssh',
      '--codespace', codespaceName,
      '--', '-t',
      'claude'
    ];
  } else {
    console.log(chalk.gray('Checking for persistent tmux session...'));
    
    // Check if tmux session exists
    let hasTmuxSession = false;
    try {
      const checkTmuxCmd = `gh codespace ssh --codespace ${codespaceName} -- "tmux has-session -t claude-work 2>/dev/null && echo 'exists' || echo 'none'"`;
      const result = execSync(checkTmuxCmd, { encoding: 'utf8' }).trim();
      hasTmuxSession = result.includes('exists');
    } catch (error) {
      // If check fails, assume no tmux session
      hasTmuxSession = false;
    }
    
    // Choose connection command based on tmux session existence
    if (hasTmuxSession) {
      console.log(chalk.green('✓ Found persistent tmux session'));
      console.log(chalk.gray('💡 Tip: Use Ctrl+B then D to detach and keep session running'));
      connectArgs = [
        'codespace', 'ssh',
        '--codespace', codespaceName,
        '--', '-t',
        'tmux', 'attach-session', '-t', 'claude-work'
      ];
    } else {
      console.log(chalk.gray('No tmux session found, connecting directly to Claude'));
      connectArgs = [
        'codespace', 'ssh',
        '--codespace', codespaceName,
        '--', '-t',
        'claude'
      ];
    }
  }
  
  const connectProcess = spawn('gh', connectArgs, {
    stdio: 'inherit',
  });
  
  connectProcess.on('exit', (code: number) => {
    console.log(chalk.yellow('\n📤 Session disconnected'));
    process.exit(code);
  });
}

async function cleanupSessions(codespaceManager: CodespaceManager): Promise<void> {
  console.log(chalk.blue('🧹 Cleaning up old sessions...'));
  
  const codespaces = await codespaceManager.listActiveCodespaces();
  
  if (codespaces.length === 0) {
    console.log(chalk.gray('No sessions to clean up'));
    return;
  }
  
  const inquirer = await import('inquirer');
  
  const choices = codespaces.map(cs => ({
    name: `${cs.name} (${cs.repository.full_name}) - ${cs.state}`,
    value: cs.name,
    checked: cs.state !== 'Available', // Pre-select non-available ones
  }));
  
  const { sessionsToDelete } = await inquirer.default.prompt([{
    type: 'checkbox',
    name: 'sessionsToDelete',
    message: 'Select sessions to delete:',
    choices,
  }]);
  
  if (sessionsToDelete.length === 0) {
    console.log(chalk.gray('No sessions selected for deletion'));
    return;
  }
  
  for (const sessionName of sessionsToDelete) {
    try {
      console.log(chalk.blue('🗑️  Deleting:'), sessionName);
      await codespaceManager.cleanupCodespaceByName(sessionName, true);
      console.log(chalk.green('✅ Deleted:'), sessionName);
    } catch (error) {
      console.error(chalk.red('❌ Failed to delete:'), sessionName, (error as Error).message);
    }
  }
  
  console.log(chalk.green('✨ Cleanup completed'));
}

export function createSessionCommand(): Command {
  const command = new Command('session');
  
  return command
    .description('Manage interactive Claude Code sessions')
    .option('-l, --list', 'List active sessions (default)')
    .option('-c, --connect <name>', 'Connect to an existing session')
    .option('-d, --direct', 'Connect directly to Claude (bypass tmux)')
    .option('--cleanup', 'Clean up old sessions')
    .action(sessionCommand);
}