#!/usr/bin/env node

import { Command } from 'commander';
import { chalk } from '@remote-claude/ui';
import { version } from '../package.json';
import { createRunCommand } from './commands/run';
import { createStatusCommand } from './commands/status';
import { createResultsCommand } from './commands/results';
import { createConfigCommand } from './commands/config';
import { createLogsCommand } from './commands/logs';
import { createCancelCommand } from './commands/cancel';
import { createSessionCommand } from './commands/session';
import { createEC2Command } from './commands/ec2';
import { createTasksCommand } from './commands/tasks';
import { createInitCommand } from './commands/init';

const program = new Command();

program
  .name('rclaude')
  .description('Remote Claude CLI - Run Claude Code tasks remotely on GitHub Codespaces or AWS EC2')
  .version(version);

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createRunCommand());
program.addCommand(createTasksCommand());
program.addCommand(createStatusCommand());
program.addCommand(createResultsCommand());
program.addCommand(createConfigCommand());
program.addCommand(createLogsCommand());
program.addCommand(createCancelCommand());
program.addCommand(createSessionCommand());
program.addCommand(createEC2Command());

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('❌ Unknown command:'), program.args.join(' '));
  console.log(chalk.gray('Run'), chalk.blue('rclaude --help'), chalk.gray('for available commands'));
  process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();