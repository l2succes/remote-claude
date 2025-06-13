#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';
import { createRunCommand } from './cli/commands/run';
import { createStatusCommand } from './cli/commands/status';
import { createResultsCommand } from './cli/commands/results';
import { createConfigCommand } from './cli/commands/config';
import { createLogsCommand } from './cli/commands/logs';
import { createCancelCommand } from './cli/commands/cancel';
import { createSessionCommand } from './cli/commands/session';

const program = new Command();

program
  .name('rclaude')
  .description('Remote Claude CLI - Run Claude Code tasks in GitHub Codespaces')
  .version(version);

// Add commands
program.addCommand(createRunCommand());
program.addCommand(createStatusCommand());
program.addCommand(createResultsCommand());
program.addCommand(createConfigCommand());
program.addCommand(createLogsCommand());
program.addCommand(createCancelCommand());
program.addCommand(createSessionCommand());

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