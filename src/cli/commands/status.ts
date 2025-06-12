import { Command } from 'commander';
import chalk from 'chalk';

export interface StatusOptions {
  all?: boolean;
  json?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  try {
    console.log(chalk.blue('📊 Task Status'));
    
    // TODO: Implement status display
    console.log(chalk.yellow('⚠️  Not implemented yet'));
    console.log(chalk.gray('This feature is coming soon!'));
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createStatusCommand(): Command {
  const command = new Command('status');
  
  return command
    .description('Show running and completed tasks')
    .option('-a, --all', 'Show all tasks (including completed)')
    .option('-j, --json', 'Output in JSON format')
    .action(statusCommand);
}