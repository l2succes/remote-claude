import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TaskRegistry } from '../utils/task-registry';
import { formatDistanceToNow } from '../../utils/date';

interface TasksOptions {
  repository?: string;
  tags?: string;
  search?: string;
  recent?: boolean;
  frequent?: boolean;
  json?: boolean;
}

export async function tasksCommand(options: TasksOptions): Promise<void> {
  try {
    const taskRegistry = new TaskRegistry();
    
    let tasks;
    
    if (options.recent) {
      tasks = taskRegistry.getRecentTasks(20);
      console.log(chalk.blue('📋 Recently used tasks:'));
    } else if (options.frequent) {
      tasks = taskRegistry.getFrequentTasks(20);
      console.log(chalk.blue('📋 Frequently used tasks:'));
    } else {
      const filter: Parameters<typeof taskRegistry.listTasks>[0] = {};
      if (options.repository) filter.repository = options.repository;
      if (options.tags) filter.tags = options.tags.split(',').filter(Boolean);
      if (options.search) filter.search = options.search;
      
      tasks = taskRegistry.listTasks(filter);
      
      if (options.search) {
        console.log(chalk.blue(`📋 Tasks matching "${options.search}":`));
      } else {
        console.log(chalk.blue('📋 All saved tasks:'));
      }
    }
    
    if (tasks.length === 0) {
      console.log(chalk.gray('No tasks found'));
      console.log(chalk.gray('Create a new task by running:'), chalk.blue('rclaude run <task-id>'));
      return;
    }
    
    if (options.json) {
      console.log(JSON.stringify(tasks, null, 2));
      return;
    }
    
    // Display tasks in a table format
    console.log();
    tasks.forEach((task, index) => {
      const lastRun = task.lastRunAt 
        ? chalk.gray(`last run ${formatDistanceToNow(task.lastRunAt)} ago`)
        : chalk.gray('never run');
      
      const runCount = task.runCount > 0 
        ? chalk.gray(`(${task.runCount} runs)`)
        : '';
      
      console.log(
        chalk.green(`${index + 1}.`),
        chalk.bold(task.id),
        chalk.gray('-'),
        task.name
      );
      console.log(
        chalk.gray('   '),
        chalk.gray(task.description.substring(0, 60) + (task.description.length > 60 ? '...' : ''))
      );
      console.log(
        chalk.gray('   '),
        chalk.gray(`📁 ${task.repository}`),
        task.branch ? chalk.gray(`(${task.branch})`) : '',
        lastRun,
        runCount
      );
      
      if (task.tags && task.tags.length > 0) {
        console.log(
          chalk.gray('   '),
          chalk.gray('🏷️ '),
          task.tags.map(tag => chalk.cyan(`#${tag}`)).join(' ')
        );
      }
      
      if (task.defaultOptions?.provider) {
        console.log(
          chalk.gray('   '),
          chalk.gray('☁️ '),
          chalk.gray(task.defaultOptions.provider),
          task.defaultOptions.provider === 'ec2' 
            ? chalk.gray(`(${task.defaultOptions.ec2InstanceType})`)
            : chalk.gray(`(${task.defaultOptions.machineType})`)
        );
      }
      
      console.log();
    });
    
    // Show task management options
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Run a task', value: 'run' },
        { name: 'Edit a task', value: 'edit' },
        { name: 'Delete a task', value: 'delete' },
        { name: 'Export tasks', value: 'export' },
        { name: 'Exit', value: 'exit' },
      ],
    }]);
    
    if (action === 'exit') {
      return;
    }
    
    if (action === 'run') {
      const { taskIndex } = await inquirer.prompt([{
        type: 'number',
        name: 'taskIndex',
        message: 'Enter task number to run:',
        validate: (input) => {
          const num = parseInt(input);
          return num >= 1 && num <= tasks.length || 'Please enter a valid task number';
        },
      }]);
      
      const selectedTask = tasks[taskIndex - 1];
      if (!selectedTask) {
        console.error(chalk.red('❌ Invalid task selection'));
        return;
      }
      
      console.log(chalk.blue(`\n🚀 Running task: ${selectedTask.id}`));
      console.log(chalk.gray('Run with:'), chalk.blue(`rclaude run ${selectedTask.id}`));
      
      // Actually run the task
      const { spawn } = require('child_process');
      const runProcess = spawn('node', ['dist/cli.js', 'run', selectedTask.id], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      runProcess.on('exit', (code: number) => {
        process.exit(code);
      });
    }
    
    if (action === 'edit') {
      const { taskIndex } = await inquirer.prompt([{
        type: 'number',
        name: 'taskIndex',
        message: 'Enter task number to edit:',
        validate: (input) => {
          const num = parseInt(input);
          return num >= 1 && num <= tasks.length || 'Please enter a valid task number';
        },
      }]);
      
      const selectedTask = tasks[taskIndex - 1];
      if (!selectedTask) {
        console.error(chalk.red('❌ Invalid task selection'));
        return;
      }
      
      // Prompt for updates
      const updates = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Task name:',
          default: selectedTask.name,
        },
        {
          type: 'input',
          name: 'description',
          message: 'Task description:',
          default: selectedTask.description,
        },
        {
          type: 'input',
          name: 'repository',
          message: 'Repository (owner/repo):',
          default: selectedTask.repository,
        },
        {
          type: 'input',
          name: 'branch',
          message: 'Default branch:',
          default: selectedTask.branch || 'main',
        },
        {
          type: 'input',
          name: 'tags',
          message: 'Tags (comma-separated):',
          default: selectedTask.tags?.join(', ') || '',
          filter: (input) => input ? input.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        },
      ]);
      
      taskRegistry.updateTask(selectedTask.id, {
        name: updates.name,
        description: updates.description,
        repository: updates.repository,
        branch: updates.branch || undefined,
        tags: updates.tags,
      });
      
      console.log(chalk.green('✅ Task updated successfully!'));
    }
    
    if (action === 'delete') {
      const { taskIndex } = await inquirer.prompt([{
        type: 'number',
        name: 'taskIndex',
        message: 'Enter task number to delete:',
        validate: (input) => {
          const num = parseInt(input);
          return num >= 1 && num <= tasks.length || 'Please enter a valid task number';
        },
      }]);
      
      const selectedTask = tasks[taskIndex - 1];
      if (!selectedTask) {
        console.error(chalk.red('❌ Invalid task selection'));
        return;
      }
      
      const { confirmDelete } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmDelete',
        message: `Are you sure you want to delete task "${selectedTask.name}" (${selectedTask.id})?`,
        default: false,
      }]);
      
      if (confirmDelete) {
        taskRegistry.deleteTask(selectedTask.id);
        console.log(chalk.green('✅ Task deleted successfully!'));
      }
    }
    
    if (action === 'export') {
      const { exportPath } = await inquirer.prompt([{
        type: 'input',
        name: 'exportPath',
        message: 'Export file path:',
        default: 'tasks-export.json',
      }]);
      
      const taskIds = tasks.map(t => t.id);
      const count = await taskRegistry.exportTasks(exportPath, taskIds);
      console.log(chalk.green(`✅ Exported ${count} tasks to ${exportPath}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createTasksCommand(): Command {
  const command = new Command('tasks');
  
  return command
    .description('List and manage saved tasks')
    .option('-r, --repository <repo>', 'Filter by repository')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('-s, --search <query>', 'Search tasks by name or description')
    .option('--recent', 'Show recently used tasks')
    .option('--frequent', 'Show frequently used tasks')
    .option('-j, --json', 'Output in JSON format')
    .action(tasksCommand);
}