import { Command } from 'commander';
import { chalk } from '@remote-claude/ui';
import { inquirer } from '@remote-claude/ui';
import { ConfigManagerV2 } from '@remote-claude/config';
import { getCurrentGitRepository } from '../utils/git';
import * as fs from 'fs';
import * as path from 'path';

export async function initCommand(): Promise<void> {
  try {
    console.log(chalk.blue('🚀 Initializing Remote Claude for this project'));
    console.log();
    
    const configManager = new ConfigManagerV2();
    
    // Check if project config already exists
    const projectConfigPath = path.join(process.cwd(), '.rclaude.json');
    if (fs.existsSync(projectConfigPath)) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Project configuration already exists. Overwrite?',
        default: false,
      }]);
      
      if (!overwrite) {
        console.log(chalk.gray('Initialization cancelled'));
        return;
      }
    }
    
    // Get current repository
    const currentRepo = getCurrentGitRepository();
    
    // Prompt for project configuration
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'repository',
        message: 'GitHub repository (owner/repo):',
        default: currentRepo,
        when: !currentRepo,
        validate: (input) => {
          if (!input) return 'Repository is required';
          if (!input.includes('/')) return 'Repository must be in owner/repo format';
          return true;
        },
      },
      {
        type: 'list',
        name: 'defaultBackend',
        message: 'Default compute backend for this project:',
        choices: [
          {
            name: 'GitHub Codespaces - Cloud development environments',
            value: 'codespace',
          },
          {
            name: 'AWS EC2 - Scalable cloud compute instances',
            value: 'ec2',
          },
        ],
        default: configManager.getDefaultBackend(),
      },
      {
        type: 'list',
        name: 'defaultMachine',
        message: 'Default Codespace machine type:',
        choices: [
          { name: 'Basic (2 cores, 8GB RAM)', value: 'basicLinux32gb' },
          { name: 'Standard (4 cores, 16GB RAM)', value: 'standardLinux32gb' },
          { name: 'Premium (8 cores, 32GB RAM)', value: 'premiumLinux' },
        ],
        default: 'basicLinux32gb',
        when: (answers) => answers.defaultBackend === 'codespace',
      },
      {
        type: 'list',
        name: 'instanceType',
        message: 'Default EC2 instance type:',
        choices: [
          { name: 't3.micro (1 vCPU, 1GB RAM) - Free tier', value: 't3.micro' },
          { name: 't3.small (2 vCPU, 2GB RAM)', value: 't3.small' },
          { name: 't3.medium (2 vCPU, 4GB RAM)', value: 't3.medium' },
          { name: 't3.large (2 vCPU, 8GB RAM)', value: 't3.large' },
          { name: 'c5.large (2 vCPU, 4GB RAM) - Compute optimized', value: 'c5.large' },
        ],
        default: 't3.medium',
        when: (answers) => answers.defaultBackend === 'ec2',
      },
      {
        type: 'number',
        name: 'timeout',
        message: 'Default task timeout (seconds):',
        default: 7200,
        validate: (input) => {
          const num = parseInt(input);
          return num > 0 || 'Timeout must be positive';
        },
      },
      {
        type: 'confirm',
        name: 'autoCommit',
        message: 'Auto-commit changes by default?',
        default: false,
      },
      {
        type: 'confirm',
        name: 'pullRequest',
        message: 'Create pull requests by default?',
        default: false,
      },
    ]);
    
    // Create project configuration
    const projectConfig: any = {
      defaultBackend: answers.defaultBackend,
      defaults: {
        timeout: answers.timeout,
        autoCommit: answers.autoCommit,
        pullRequest: answers.pullRequest,
      },
    };
    
    // Add repository if not detected
    if (!currentRepo && answers.repository) {
      if (!projectConfig.github) projectConfig.github = {};
      projectConfig.github.defaultRepository = answers.repository;
    }
    
    // Add backend-specific config
    if (answers.defaultBackend === 'codespace' && answers.defaultMachine) {
      if (!projectConfig.github) projectConfig.github = {};
      projectConfig.github.defaultMachine = answers.defaultMachine;
    } else if (answers.defaultBackend === 'ec2' && answers.instanceType) {
      if (!projectConfig.ec2) projectConfig.ec2 = {};
      projectConfig.ec2.instanceType = answers.instanceType;
    }
    
    // Save project configuration
    await configManager.set('', projectConfig, 'project');
    
    // Create .gitignore entry if needed
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('.rclaude')) {
        const { addToGitignore } = await inquirer.prompt([{
          type: 'confirm',
          name: 'addToGitignore',
          message: 'Add .rclaude/ to .gitignore?',
          default: true,
        }]);
        
        if (addToGitignore) {
          fs.appendFileSync(gitignorePath, '\n# Remote Claude\n.rclaude/\n');
          console.log(chalk.green('✅ Added .rclaude/ to .gitignore'));
        }
      }
    }
    
    // Show sample tasks
    console.log();
    console.log(chalk.blue('📋 Example tasks for this project:'));
    console.log();
    console.log(chalk.gray('  # Create a task for fixing bugs'));
    console.log(chalk.green('  rclaude run fix-bug'));
    console.log();
    console.log(chalk.gray('  # Create a task for adding features'));
    console.log(chalk.green('  rclaude run add-feature'));
    console.log();
    console.log(chalk.gray('  # Create a task for refactoring'));
    console.log(chalk.green('  rclaude run refactor'));
    console.log();
    
    console.log(chalk.green('✅ Project initialized successfully!'));
    console.log(chalk.gray(`Configuration saved to: ${projectConfigPath}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createInitCommand(): Command {
  const command = new Command('init');
  
  return command
    .description('Initialize Remote Claude for the current project')
    .action(initCommand);
}