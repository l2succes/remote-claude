import { Command } from 'commander';
import { chalk } from '@remote-claude/ui';

export interface ResultsOptions {
  downloadDir?: string;
  open?: boolean;
}

export async function resultsCommand(taskId: string, options: ResultsOptions): Promise<void> {
  try {
    console.log(chalk.blue('📁 Downloading task results...'));
    console.log(chalk.gray(`Task ID: ${taskId}`));
    
    if (options.downloadDir) {
      console.log(chalk.gray(`Download directory: ${options.downloadDir}`));
    }
    
    if (options.open) {
      console.log(chalk.gray('Will open results directory after download'));
    }
    
    // TODO: Implement results download
    console.log(chalk.yellow('⚠️  Not implemented yet'));
    console.log(chalk.gray('This feature is coming soon!'));
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createResultsCommand(): Command {
  const command = new Command('results');
  
  return command
    .description('Download results from a completed task')
    .argument('<task-id>', 'The task ID to download results for')
    .option('-d, --download-dir <directory>', 'Download directory', './results')
    .option('--open', 'Open results directory after download')
    .action(resultsCommand);
}