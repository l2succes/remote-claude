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
import { createEC2Command } from './cli/commands/ec2';
import { createTasksCommand } from './cli/commands/tasks';
import { createInitCommand } from './cli/commands/init';
import { createInitDeploymentCommand } from './cli/commands/init-deployment';
import { createSSHCommand } from './cli/commands/ssh';

const program = new Command();

program
  .name('rclaude')
  .description('Remote Claude CLI - Run Claude Code tasks remotely on GitHub Codespaces or AWS EC2')
  .version(version);

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createInitDeploymentCommand());
program.addCommand(createRunCommand());
program.addCommand(createTasksCommand());
program.addCommand(createStatusCommand());
program.addCommand(createResultsCommand());
program.addCommand(createConfigCommand());
program.addCommand(createLogsCommand());
program.addCommand(createCancelCommand());
program.addCommand(createSessionCommand());
program.addCommand(createEC2Command());
program.addCommand(createSSHCommand());

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