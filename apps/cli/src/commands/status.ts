import { Command } from 'commander';
import { chalk } from '@remote-claude/ui';
import { ConfigManager } from '@remote-claude/config';
import { AuthManager } from '../utils/auth';
import { TaskManager } from '@remote-claude/core';
import { Task, TaskStatus } from '@remote-claude/core';

export interface StatusOptions {
  all?: boolean;
  json?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  try {
    console.log(chalk.blue('📊 Task Status'));
    
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
    
    // Initialize task manager
    const taskManager = new TaskManager({
      token,
      autoStart: false,
    });
    
    await taskManager.start();
    
    // Get tasks
    const filter = options.all ? {} : { 
      status: ['pending', 'queued', 'running'] as TaskStatus[] 
    };
    const tasks = await taskManager.listTasks(filter);
    
    if (options.json) {
      console.log(JSON.stringify({ tasks, stats: taskManager.getQueueStats() }, null, 2));
      await taskManager.stop();
      return;
    }
    
    // Display tasks
    displayTaskStatus(tasks, taskManager.getQueueStats());
    
    await taskManager.stop();
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

function displayTaskStatus(tasks: Task[], stats: any): void {
  console.log(chalk.gray('─'.repeat(80)));
  
  // Display statistics
  console.log(chalk.yellow('Queue Statistics:'));
  console.log(`  Total tasks: ${chalk.green(stats.total)}`);
  console.log(`  Running: ${chalk.blue(stats.running)}`);
  console.log(`  Queued: ${chalk.yellow(stats.queued)}`);
  console.log(`  Completed: ${chalk.green(stats.byStatus.completed)}`);
  console.log(`  Failed: ${chalk.red(stats.byStatus.failed)}`);
  console.log(`  Cancelled: ${chalk.gray(stats.byStatus.cancelled)}`);
  
  console.log(chalk.gray('─'.repeat(80)));
  
  if (tasks.length === 0) {
    console.log(chalk.gray('No tasks found'));
    return;
  }
  
  // Group tasks by status
  const tasksByStatus = tasks.reduce((acc, task) => {
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);
  
  // Display tasks by status
  const statusOrder: TaskStatus[] = ['running', 'queued', 'pending', 'completed', 'failed', 'cancelled', 'timeout'];
  
  for (const status of statusOrder) {
    const statusTasks = tasksByStatus[status];
    if (!statusTasks || statusTasks.length === 0) continue;
    
    const emoji = getStatusEmoji(status);
    const color = getStatusColor(status);
    
    console.log(chalk[color](`\n${emoji} ${status.toUpperCase()} (${statusTasks.length})`));
    
    statusTasks.forEach(task => {
      const duration = getDuration(task);
      const priority = getPriorityIcon(task.priority);
      
      console.log(`  ${priority} ${chalk.white(task.name)} ${chalk.gray(`(${task.id})`)}`);
      console.log(`      ${chalk.gray(`Repository: ${task.repository}`)}`);
      if (task.branch) {
        console.log(`      ${chalk.gray(`Branch: ${task.branch}`)}`);
      }
      console.log(`      ${chalk.gray(`Created: ${formatDate(task.createdAt)}`)}`);
      if (duration) {
        console.log(`      ${chalk.gray(`Duration: ${duration}`)}`);
      }
    });
  }
}

function getStatusEmoji(status: TaskStatus): string {
  const emojis: Record<TaskStatus, string> = {
    pending: '⏳',
    queued: '📝',
    running: '▶️',
    completed: '✅',
    failed: '❌',
    cancelled: '🛑',
    timeout: '⏰',
  };
  return emojis[status] || '❓';
}

function getStatusColor(status: TaskStatus): 'red' | 'yellow' | 'green' | 'blue' | 'gray' {
  const colors: Record<TaskStatus, 'red' | 'yellow' | 'green' | 'blue' | 'gray'> = {
    pending: 'gray',
    queued: 'yellow',
    running: 'blue',
    completed: 'green',
    failed: 'red',
    cancelled: 'gray',
    timeout: 'red',
  };
  return colors[status] || 'gray';
}

function getPriorityIcon(priority: string): string {
  const icons: Record<string, string> = {
    urgent: '🔴',
    high: '🟡',
    normal: '🟢',
    low: '🔵',
  };
  return icons[priority] || '⚪';
}

function getDuration(task: Task): string | null {
  if (task.startedAt && task.completedAt) {
    const duration = Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 1000);
    return formatDuration(duration);
  } else if (task.startedAt) {
    const duration = Math.round((Date.now() - task.startedAt.getTime()) / 1000);
    return `${formatDuration(duration)} (running)`;
  }
  return null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleString();
}

export function createStatusCommand(): Command {
  const command = new Command('status');
  
  return command
    .description('Show running and completed tasks')
    .option('-a, --all', 'Show all tasks (including completed)')
    .option('-j, --json', 'Output in JSON format')
    .action(statusCommand);
}