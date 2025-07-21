import { Command } from 'commander';
import { chalk } from '@remote-claude/ui';

export interface CancelOptions {
  force?: boolean;
}

export async function cancelCommand(taskId: string, options: CancelOptions): Promise<void> {
  try {
    console.log(chalk.blue('🛑 Cancelling task...'));
    console.log(chalk.gray(`Task ID: ${taskId}`));
    
    if (options.force) {
      console.log(chalk.gray('Force cancellation enabled'));
    }
    
    // TODO: Implement task cancellation
    console.log(chalk.yellow('⚠️  Not implemented yet'));
    console.log(chalk.gray('This feature is coming soon!'));
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createCancelCommand(): Command {
  const command = new Command('cancel');
  
  return command
    .description('Cancel a running task')
    .argument('<task-id>', 'The task ID to cancel')
    .option('-f, --force', 'Force cancellation without confirmation')
    .action(cancelCommand);
}