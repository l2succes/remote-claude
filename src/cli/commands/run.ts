import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../utils/config';
import { ConfigManagerV2 } from '../utils/config-v2';
import { AuthManager } from '../utils/auth';
import { TaskManager } from '../../tasks/manager';
import { TaskPriority } from '../../tasks/types';
import { ComputeProviderType, ComputeConfig } from '../../compute';
import { getCurrentGitRepository } from '../utils/git';
import { TaskRegistry, TaskDefinition } from '../utils/task-registry';
import { ProviderFactory } from '../../services/compute/providers/provider-factory';
import { AWSSetupHelper } from '../../utils/aws-setup-helper';

export interface RunOptions {
  repo?: string;
  branch?: string;
  timeout?: string;
  priority?: string;
  notify?: string;
  notifyOnStart?: boolean;
  notifyOnComplete?: boolean;
  notifyOnFail?: boolean;
  autoCommit?: boolean;
  pullRequest?: boolean;
  output?: string;
  name?: string;
  interactive?: boolean;
  persistent?: boolean;
  idleTimeout?: number;
  machineType?: string;
  sessionId?: string;
  // Compute provider options
  provider?: string;
  awsMode?: string;  // For AWS backend: 'ec2', 'ecs', 'shared'
  ec2InstanceType?: string;
  ec2Spot?: boolean;
  ec2Region?: string;
  verbose?: boolean;
}

export async function runCommand(taskId: string, options: RunOptions): Promise<void> {
  try {
    // Set log level based on verbose option
    if (!options.verbose) {
      process.env.LOG_LEVEL = 'ERROR';
    } else {
      process.env.LOG_LEVEL = 'INFO';
    }
    
    // Initialize managers
    const configManager = new ConfigManager();
    const configManagerV2 = new ConfigManagerV2();
    const authManager = new AuthManager(configManager);
    const taskRegistry = new TaskRegistry();
    
    // Initialize the singleton Config with values from ConfigManagerV2
    const { Config } = await import('../../utils/config');
    const mergedConfig = configManagerV2.getMergedConfig();
    Config.initialize(mergedConfig);
    
    // Check authentication
    const token = await authManager.getGitHubToken();
    if (!token) {
      console.error(chalk.red('❌ Not authenticated'));
      console.log(chalk.yellow('Run'), chalk.blue('rclaude config github'), chalk.yellow('to set up authentication'));
      process.exit(1);
    }
    
    // Check if task exists or create new one
    let taskDef: TaskDefinition | null = taskRegistry.getTask(taskId);
    
    if (!taskDef) {
      console.log(chalk.yellow(`⚠️  Task '${taskId}' not found in registry`));
      
      const { createTask } = await inquirer.prompt([{
        type: 'confirm',
        name: 'createTask',
        message: `Would you like to create a new task with ID '${taskId}'?`,
        default: true,
      }]);
      
      if (!createTask) {
        console.log(chalk.gray('Task creation cancelled'));
        process.exit(0);
      }
      
      // Get current repository as default
      const currentRepo = getCurrentGitRepository();
      const defaultRepo = currentRepo || configManagerV2.getDefaultRepository();
      
      // Prompt for task details
      const taskDetails = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Task name:',
          default: taskId,
          validate: (input) => input.length > 0 || 'Task name is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Task description (what should Claude do?):',
          validate: (input) => input.length > 0 || 'Task description is required',
        },
        {
          type: 'input',
          name: 'repository',
          message: 'Repository (owner/repo):',
          default: defaultRepo,
          validate: (input) => {
            if (!input) return 'Repository is required';
            if (!input.includes('/')) return 'Repository must be in owner/repo format';
            return true;
          },
        },
        {
          type: 'input',
          name: 'branch',
          message: 'Default branch (optional):',
          default: 'main',
        },
        {
          type: 'input',
          name: 'tags',
          message: 'Tags (comma-separated, optional):',
          filter: (input) => input ? input.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        },
        {
          type: 'list',
          name: 'provider',
          message: 'Default compute provider:',
          choices: [
            { name: 'GitHub Codespaces', value: 'codespace' },
            { name: 'Amazon Web Services (AWS)', value: 'aws' },
            { name: 'Fly.io (Edge Computing)', value: 'fly' },
          ],
          default: configManagerV2.getDefaultBackend(),
        },
      ]);
      
      // Additional prompts based on provider
      let defaultOptions: TaskDefinition['defaultOptions'] = {
        provider: taskDetails.provider,
      };
      
      if (taskDetails.provider === 'ec2') {
        const ec2Options = await inquirer.prompt([
          {
            type: 'input',
            name: 'ec2InstanceType',
            message: 'EC2 instance type:',
            default: configManagerV2.get('ec2.instanceType') || 't3.medium',
          },
          {
            type: 'input',
            name: 'ec2Region',
            message: 'AWS region:',
            default: configManagerV2.get('ec2.region') || 'us-east-1',
          },
        ]);
        defaultOptions = { ...defaultOptions, ...ec2Options };
      } else if (taskDetails.provider === 'aws') {
        const ecsOptions = await inquirer.prompt([
          {
            type: 'input',
            name: 'instanceType',
            message: 'EC2 instance type for ECS cluster:',
            default: configManagerV2.get('ecs.instanceType') || 't3.medium',
          },
          {
            type: 'input',
            name: 'region',
            message: 'AWS region:',
            default: configManagerV2.get('ecs.region') || 'us-east-1',
          },
          {
            type: 'confirm',
            name: 'enableSpot',
            message: 'Use spot instances for cost savings?',
            default: true,
          },
        ]);
        defaultOptions = { ...defaultOptions, ...ecsOptions };
      } else if (taskDetails.provider === 'fly') {
        const flyOptions = await inquirer.prompt([
          {
            type: 'list',
            name: 'machineSize',
            message: 'Fly.io machine size:',
            choices: [
              { name: 'Shared CPU 1x (256MB)', value: 'shared-cpu-1x' },
              { name: 'Shared CPU 2x (512MB)', value: 'shared-cpu-2x' },
              { name: 'Dedicated CPU 1x (2GB)', value: 'dedicated-cpu-1x' },
              { name: 'Dedicated CPU 2x (4GB)', value: 'dedicated-cpu-2x' },
            ],
            default: 'shared-cpu-1x',
          },
          {
            type: 'input',
            name: 'region',
            message: 'Fly.io region (iad, lhr, nrt, syd):',
            default: 'iad',
          },
        ]);
        defaultOptions = { ...defaultOptions, ...flyOptions };
      } else {
        const codespaceOptions = await inquirer.prompt([
          {
            type: 'list',
            name: 'machineType',
            message: 'Codespace machine type:',
            choices: [
              { name: 'Basic (2 cores, 8GB RAM)', value: 'basicLinux32gb' },
              { name: 'Standard (4 cores, 16GB RAM)', value: 'standardLinux32gb' },
              { name: 'Premium (8 cores, 32GB RAM)', value: 'premiumLinux' },
            ],
            default: 'basicLinux32gb',
          },
        ]);
        defaultOptions = { ...defaultOptions, ...codespaceOptions };
      }
      
      // Create the task
      taskDef = taskRegistry.createTask({
        id: taskId,
        name: taskDetails.name,
        description: taskDetails.description,
        repository: taskDetails.repository,
        branch: taskDetails.branch || undefined,
        tags: taskDetails.tags,
        defaultOptions,
      });
      
      console.log(chalk.green('✅ Task created successfully!'));
    }
    
    // Record that we're running this task
    taskRegistry.recordRun(taskId);
    
    console.log(chalk.blue('🚀 Starting remote Claude Code task...'));
    console.log(chalk.gray(`Task ID: ${taskId}`));
    console.log(chalk.gray(`Task: ${taskDef.name}`));
    console.log(chalk.gray(`Description: ${taskDef.description}`));
    
    // Merge options: CLI options > task defaults > config defaults
    const repository = options.repo || taskDef.repository;
    const branch = options.branch || taskDef.branch || taskDef.defaultOptions?.branch;
    const timeout = options.timeout || taskDef.defaultOptions?.timeout?.toString() || '7200';
    const priority = (options.priority as TaskPriority) || (taskDef.defaultOptions?.priority as TaskPriority) || 'normal';
    const provider = options.provider || 
                     taskDef.defaultOptions?.provider || 
                     configManagerV2.getDefaultBackend();
    
    console.log(chalk.gray(`Repository: ${repository}`));
    if (branch) {
      console.log(chalk.gray(`Branch: ${branch}`));
    }
    console.log(chalk.gray(`Timeout: ${timeout}s`));
    console.log(chalk.gray(`Priority: ${priority}`));
    console.log(chalk.gray(`Provider: ${provider}`));
    
    // Validate and show codespace configuration
    if (options.idleTimeout) {
      if (options.idleTimeout < 30 || options.idleTimeout > 1440) {
        console.error(chalk.red('❌ Idle timeout must be between 30 and 1440 minutes (24 hours)'));
        process.exit(1);
      }
      console.log(chalk.gray(`Idle timeout: ${options.idleTimeout} minutes`));
    }
    if (options.machineType && options.machineType !== 'basicLinux32gb') {
      console.log(chalk.gray(`Machine type: ${options.machineType}`));
    }
    
    if (options.interactive) {
      // Interactive mode - create environment and connect directly
      console.log(chalk.blue('🖥️  Starting interactive Claude Code session...'));
      
      // Validate session ID if provided
      if (options.sessionId) {
        const sessionIdRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;
        if (!sessionIdRegex.test(options.sessionId)) {
          console.error(chalk.red('❌ Invalid session ID format'));
          console.log(chalk.yellow('Session ID must be alphanumeric with hyphens, no spaces, and cannot start/end with hyphen'));
          process.exit(1);
        }
        if (options.sessionId.length > 50) {
          console.error(chalk.red('❌ Session ID too long (max 50 characters)'));
          process.exit(1);
        }
      }
      
      // Build compute configuration for interactive session
      const computeConfig = buildComputeConfig(options, taskDef, configManagerV2);
      const sessionId = options.sessionId || `interactive-${Date.now()}`;
      console.log(chalk.gray(`Session ID: ${sessionId}`));
      
      // Get the appropriate provider based on user selection
      let providerName = provider;
      
      // Handle unified AWS backend
      if (provider === 'aws') {
        providerName = 'aws';
        const awsMode = configManagerV2.getAWSMode();
        console.log(chalk.gray(`AWS mode: ${awsMode}`));
      }
      
      // Check if using AWS provider and needs setup
      if (providerName === 'aws') {
        const hasCredentials = await AWSSetupHelper.checkAWSCredentials();
        if (!hasCredentials) {
          AWSSetupHelper.showSetupInstructions();
          AWSSetupHelper.suggestAlternatives();
          process.exit(1);
        }
      }
      
      // Initialize provider factory
      try {
        await ProviderFactory.initialize();
      } catch (error) {
        console.error(chalk.red('❌ Failed to initialize compute providers'));
        console.error(chalk.gray('Error:'), (error as Error).message);
        
        if (providerName.includes('ec2') || providerName.includes('ecs')) {
          console.log(chalk.yellow('\n⚠️  This might be due to AWS configuration issues.'));
          AWSSetupHelper.suggestAlternatives();
        }
        process.exit(1);
      }
      
      if (providerName === 'aws' || providerName === 'fly') {
        // Use new provider system
        // Use provider name directly
        const factoryProviderName = providerName;
        const computeProvider = await ProviderFactory.getProvider(factoryProviderName);
        
        console.log(chalk.gray(`Provider: ${providerName}`));
        
        // Create session with the new provider
        const session = await computeProvider.createSession({
          taskId: sessionId,
          userId: 'cli-user', // TODO: Get from auth
          repository,
          branch,
          resources: {
            cpu: options.machineType || taskDef.defaultOptions?.ec2InstanceType || taskDef.defaultOptions?.machineType || undefined,
            memory: '4GB', // TODO: Make configurable
            disk: '50GB', // TODO: Make configurable
          }
        });
        
        console.log(chalk.green('✅ Session created!'));
        console.log(chalk.gray(`Session ID: ${session.id}`));
        console.log(chalk.gray(`Status: ${session.status}`));
        
        if (session.metadata) {
          Object.entries(session.metadata).forEach(([key, value]) => {
            console.log(chalk.gray(`${key}: ${value}`));
          });
        }
        
        // Install Claude Code
        console.log(chalk.blue('📦 Installing Claude Code...'));
        await computeProvider.executeCommand(session.id, 'sudo npm install -g @anthropic-ai/claude-code');
        
        // Clone repository
        console.log(chalk.blue('📂 Cloning repository...'));
        await computeProvider.executeCommand(session.id, `git clone https://github.com/${repository}.git /workspace && cd /workspace && git checkout ${branch || 'main'}`);
        
        console.log(chalk.green('✅ Interactive session ready!'));
        
        // Connect to the container based on provider type
        if (providerName === 'aws') {
          // Import ECS connection helper
          const { connectToECSContainer } = await import('../utils/ecs-connect');
          
          try {
            await connectToECSContainer({
              cluster: computeConfig.awsEcs?.clusterName || 'remote-claude-cluster',
              taskArn: session.metadata?.taskArn,
              container: 'claude-code',
              region: computeConfig.awsEcs?.region || 'us-east-1'
            });
            
            console.log(chalk.green('\n✅ Disconnected from ECS container'));
          } catch (error) {
            console.error(chalk.red('❌ Connection failed:'), (error as Error).message);
          }
        } else if (providerName === 'fly') {
          console.log(chalk.blue('🔗 To connect to your Fly.io session:'));
          console.log(chalk.gray('Use Fly SSH to connect'));
          console.log(chalk.gray(`fly ssh console -a ${session.metadata?.appName}`));
          
          // Wait for user to exit
          console.log(chalk.yellow('\nPress Ctrl+C to end the session...'));
        }
        
        // Handle cleanup on exit
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\n📤 Interactive session ended'));
          
          const inquirer = await import('inquirer');
          const { keepSession } = await inquirer.default.prompt([{
            type: 'confirm',
            name: 'keepSession',
            message: `Keep the ${providerName} session running?`,
            default: false,
          }]);
          
          if (!keepSession) {
            console.log(chalk.blue('🗑️  Terminating session...'));
            await computeProvider.terminateSession(session.id);
          } else {
            console.log(chalk.green('✅ Session kept running:'), session.id);
          }
          
          await ProviderFactory.shutdown();
          process.exit(0);
        });
        
        // Keep process running
        await new Promise(() => {}); // Wait forever
        
      } else if ((computeConfig.provider as any) === 'ec2') {
        // EC2 Interactive mode (existing implementation)
        const { EC2Provider } = await import('../../compute');
        const provider = new EC2Provider({
          ...computeConfig.ec2!,
          autoTerminate: false, // Keep running for interactive use
          idleTimeout: options.idleTimeout || 120, // 2 hours default for interactive
        });
        
        console.log(chalk.gray(`Provider: EC2`));
        console.log(chalk.gray(`Region: ${computeConfig.ec2!.region}`));
        console.log(chalk.gray(`Instance Type: ${computeConfig.ec2!.instanceType}`));
        
        // Create EC2 environment
        const environment = await provider.createEnvironment({
          name: sessionId
        });
        
        console.log(chalk.green('✅ EC2 instance created!'));
        console.log(chalk.gray(`Instance ID: ${environment.id}`));
        console.log(chalk.gray(`Public IP: ${environment.metadata.publicIp}`));
        
        // Install Claude Code on the instance
        console.log(chalk.blue('📦 Installing Claude Code...'));
        await provider.executeTask(environment, {
          id: 'install-claude',
          command: 'sudo npm install -g @anthropic-ai/claude-code'
        });
        
        console.log(chalk.green('✅ Interactive session ready!'));
        console.log(chalk.blue('🔗 Connecting to EC2 instance...'));
        
        // Connect via SSH using our EC2 connect command
        const { spawn } = require('child_process');
        const connectArgs = ['dist/cli.js', 'ec2', 'connect', environment.id];
        
        const interactiveProcess = spawn('node', connectArgs, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        // Handle process exit
        interactiveProcess.on('exit', async (code: number) => {
          console.log(chalk.yellow('\n📤 Interactive session ended'));
          
          // Ask user if they want to keep the instance
          const inquirer = await import('inquirer');
          const { keepInstance } = await inquirer.default.prompt([{
            type: 'confirm',
            name: 'keepInstance',
            message: 'Keep the EC2 instance running?',
            default: false,
          }]);
          
          if (!keepInstance) {
            console.log(chalk.blue('🗑️  Terminating EC2 instance...'));
            await provider.destroyEnvironment(environment.id);
          } else {
            console.log(chalk.green('✅ Instance kept running:'), environment.id);
            console.log(chalk.gray('Access it later with:'), chalk.blue(`rclaude ec2 connect ${environment.id}`));
          }
          
          process.exit(code);
        });
        
      } else {
        // Codespace Interactive mode (existing logic)
        const { CodespaceManager } = await import('../../codespace/manager');
        const codespaceManager = new CodespaceManager({
          token,
          webhookUrl: undefined, // No webhook needed for interactive
          defaultMachine: options.machineType,
          defaultIdleTimeout: options.idleTimeout,
        });
        
        await codespaceManager.checkPrerequisites();
        
        const codespace = await codespaceManager.createCodespaceForTask(sessionId, {
          task: taskDef.description,
          repository,
          branch,
          timeout: parseInt(timeout, 10),
          autoCommit: options.autoCommit,
          pullRequest: options.pullRequest,
          outputFiles: options.output?.split(','),
        });
        
        await codespaceManager.installClaudeCode(codespace.name);
        
        if (options.persistent !== false) {
          await codespaceManager.setupPersistentSession(codespace.name);
        }
        
        console.log(chalk.green('✅ Interactive session ready!'));
        console.log(chalk.blue('🔗 Connecting to codespace...'));
        
        if (options.persistent !== false) {
          console.log(chalk.gray('💡 Auto-setup: tmux session will be created'));
          console.log(chalk.gray('💡 Use Ctrl+B then D to detach and keep running'));
          console.log(chalk.gray('💡 Reconnect with: tmux attach-session -t claude-work'));
        }
        
        const { spawn } = require('child_process');
        const connectArgs = options.persistent !== false 
          ? ['codespace', 'ssh', '--codespace', codespace.name, '--', '-t', 'bash', '-c', 'if tmux has-session -t claude-work 2>/dev/null; then tmux send-keys -t claude-work:claude-code "claude" Enter && tmux attach-session -t claude-work; else claude; fi']
          : ['codespace', 'ssh', '--codespace', codespace.name, '--', '-t', 'claude'];
        
        const interactiveProcess = spawn('gh', connectArgs, {
          stdio: 'inherit',
        });
        
        interactiveProcess.on('exit', async (code: number) => {
          console.log(chalk.yellow('\n📤 Interactive session ended'));
          
          if (options.autoCommit || options.pullRequest) {
            console.log(chalk.blue('🔄 Processing changes...'));
          }
          
          const inquirer = await import('inquirer');
          const { keepCodespace } = await inquirer.default.prompt([{
            type: 'confirm',
            name: 'keepCodespace',
            message: 'Keep the codespace running?',
            default: false,
          }]);
          
          if (!keepCodespace) {
            console.log(chalk.blue('🗑️  Cleaning up codespace...'));
            await codespaceManager.cleanupCodespace(taskId, true);
          } else {
            console.log(chalk.green('✅ Codespace kept running:'), codespace.name);
            console.log(chalk.gray('Access it later with:'), chalk.blue(`gh codespace ssh --codespace ${codespace.name}`));
          }
          
          process.exit(code);
        });
      }
      
      return; // Exit early for interactive mode
    }
    
    // Build compute configuration
    const computeConfig = buildComputeConfig(options, taskDef, configManagerV2);
    
    // Use provider directly
    let effectiveProvider = provider;
    
    // For non-interactive mode with new providers
    if ((effectiveProvider === 'aws' || effectiveProvider === 'fly') && !options.notifyOnComplete) {
      
      // Check if using AWS provider and needs setup
      if (effectiveProvider === 'aws') {
        const hasCredentials = await AWSSetupHelper.checkAWSCredentials();
        if (!hasCredentials) {
          AWSSetupHelper.showSetupInstructions();
          AWSSetupHelper.suggestAlternatives();
          process.exit(1);
        }
      }
      
      // Initialize provider factory
      try {
        await ProviderFactory.initialize();
      } catch (error) {
        console.error(chalk.red('❌ Failed to initialize compute providers'));
        console.error(chalk.gray('Error:'), (error as Error).message);
        
        if (effectiveProvider === 'aws') {
          console.log(chalk.yellow('\n⚠️  This might be due to AWS configuration issues.'));
          AWSSetupHelper.suggestAlternatives();
        }
        process.exit(1);
      }
      
      console.log(chalk.blue('🚀 Starting task execution with provider:'), chalk.gray(effectiveProvider));
      
      let computeProvider;
      try {
        // Use provider name directly
        const factoryProviderName = effectiveProvider;
        computeProvider = await ProviderFactory.getProvider(factoryProviderName);
      } catch (error) {
        console.error(chalk.red('❌ Provider not available:'), effectiveProvider);
        console.error(chalk.gray('Error:'), (error as Error).message);
        
        if (effectiveProvider === 'aws') {
          console.log(chalk.yellow('\n⚠️  The AWS infrastructure may not be properly set up.'));
          console.log(chalk.blue('To deploy AWS infrastructure:'));
          console.log(chalk.white('  rclaude init-deployment --mode self-hosted'));
        }
        
        AWSSetupHelper.suggestAlternatives();
        process.exit(1);
      }
      
      // Create session for task execution
      const session = await computeProvider.createSession({
        taskId,
        userId: 'cli-user',
        repository,
        branch,
        resources: {
          cpu: options.machineType || taskDef.defaultOptions?.ec2InstanceType || taskDef.defaultOptions?.machineType || undefined,
          memory: '4GB',
          disk: '50GB',
        }
      });
      
      console.log(chalk.green('✅ Session created!'));
      console.log(chalk.gray(`Session ID: ${session.id}`));
      
      // Install Claude Code
      console.log(chalk.blue('📦 Installing Claude Code...'));
      await computeProvider.executeCommand(session.id, 'sudo npm install -g @anthropic-ai/claude-code');
      
      // Clone repository
      console.log(chalk.blue('📂 Cloning repository...'));
      await computeProvider.executeCommand(session.id, `git clone https://github.com/${repository}.git /workspace && cd /workspace && git checkout ${branch || 'main'}`);
      
      // Execute the task
      console.log(chalk.blue('🤖 Executing Claude Code task...'));
      console.log(chalk.gray(`Task: ${taskDef.description}`));
      
      const result = await computeProvider.executeCommand(session.id, `cd /workspace && claude "${taskDef.description}"`);
      
      if (result.success) {
        console.log(chalk.green('✅ Task completed successfully!'));
        if (result.output) {
          console.log(chalk.gray('Output:'), result.output);
        }
      } else {
        console.log(chalk.red('❌ Task failed'));
        if (result.error) {
          console.log(chalk.red('Error:'), result.error);
        }
      }
      
      if (options.autoCommit || options.pullRequest) {
        console.log(chalk.blue('🔄 Processing changes...'));
        // TODO: Handle auto-commit and PR creation
      }
      
      // For ECS, show how to connect since exec isn't fully working
      if (effectiveProvider === 'aws' && !result.output.startsWith('Would execute:')) {
        // Real output, we can terminate
        console.log(chalk.blue('🗑️  Terminating session...'));
        await computeProvider.terminateSession(session.id);
      } else if (effectiveProvider === 'aws') {
        // Mock output, keep container running and show connection info
        console.log(chalk.yellow('\n⚠️  ECS Exec is not fully implemented yet.'));
        console.log(chalk.blue('📦 The container is running with your code.'));
        console.log(chalk.blue('\nTo connect and run Claude Code manually:'));
        console.log(chalk.white(`  aws ecs execute-command --cluster ${computeConfig.awsEcs?.clusterName || 'remote-claude-cluster'} --task ${session.metadata?.taskArn} --container claude-code --interactive --command "/bin/bash"`));
        console.log(chalk.gray('\nThen run:'));
        console.log(chalk.white(`  cd /workspace && claude "${taskDef.description}"`));
        console.log(chalk.yellow('\nThe container will keep running. To stop it:'));
        console.log(chalk.white(`  rclaude status  # Find the session`));
        console.log(chalk.white(`  rclaude cancel ${session.id}`));
      } else {
        console.log(chalk.blue('🗑️  Terminating session...'));
        await computeProvider.terminateSession(session.id);
      }
      
      await ProviderFactory.shutdown();
      process.exit(result.success ? 0 : 1);
    }
    
    // For EC2 non-interactive mode (existing implementation)
    if ((effectiveProvider as any) === 'ec2' && !options.notifyOnComplete) {
      console.log(chalk.blue('🚀 Starting EC2 instance for task execution...'));
      
      const { EC2Provider } = await import('../../compute');
      const ec2Provider = new EC2Provider({
        ...computeConfig.ec2!,
        autoTerminate: true,
      });
      
      // Create EC2 environment
      const environment = await ec2Provider.createEnvironment({
        name: `task-${taskId}`
      });
      
      console.log(chalk.green('✅ EC2 instance created!'));
      console.log(chalk.gray(`Instance ID: ${environment.id}`));
      console.log(chalk.gray(`Public IP: ${environment.metadata.publicIp}`));
      
      // Install Claude Code
      console.log(chalk.blue('📦 Installing Claude Code...'));
      await ec2Provider.executeTask(environment, {
        id: 'install-claude',
        command: 'sudo npm install -g @anthropic-ai/claude-code'
      });
      
      // Clone repository
      console.log(chalk.blue('📂 Cloning repository...'));
      await ec2Provider.executeTask(environment, {
        id: 'clone-repo',
        command: `git clone https://github.com/${repository}.git /tmp/work && cd /tmp/work && git checkout ${branch || 'main'}`
      });
      
      // Execute the task
      console.log(chalk.blue('🤖 Executing Claude Code task...'));
      console.log(chalk.gray(`Task: ${taskDef.description}`));
      
      // Connect to EC2 and run Claude
      console.log(chalk.blue('🔗 Connecting to EC2 instance...'));
      
      const { spawn } = require('child_process');
      const sshArgs = [
        'dist/cli.js', 'ec2', 'connect', environment.id,
        '--command', `cd /tmp/work && claude "${taskDef.description}"`
      ];
      
      const taskProcess = spawn('node', sshArgs, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      taskProcess.on('exit', async (code: number) => {
        console.log(chalk.yellow('\n📤 Task execution completed'));
        
        if (options.autoCommit || options.pullRequest) {
          console.log(chalk.blue('🔄 Processing changes...'));
          // TODO: Handle auto-commit and PR creation
        }
        
        console.log(chalk.blue('🗑️  Terminating EC2 instance...'));
        await ec2Provider.destroyEnvironment(environment.id);
        
        process.exit(code);
      });
      
      return;
    }
    
    // Non-interactive mode - use task queue
    const taskManager = new TaskManager({
      token,
      autoStart: false,
      compute: computeConfig,
      // Legacy options for backward compatibility
      defaultMachine: options.machineType || taskDef.defaultOptions?.machineType,
      defaultIdleTimeout: options.idleTimeout || taskDef.defaultOptions?.idleTimeout,
    });
    
    await taskManager.start();
    
    // Create task
    const queuedTaskId = await taskManager.createTask({
      name: options.name || taskDef.name,
      command: taskDef.description,
      repository,
      branch,
      priority,
      timeout: parseInt(timeout, 10),
      autoCommit: options.autoCommit ?? taskDef.defaultOptions?.autoCommit,
      pullRequest: options.pullRequest ?? taskDef.defaultOptions?.pullRequest,
      outputFiles: options.output?.split(',') || taskDef.defaultOptions?.outputFiles,
      notifications: {
        channels: options.notify?.split(','),
        onStart: options.notifyOnStart,
        onComplete: options.notifyOnComplete ?? taskDef.defaultOptions?.notifyOnComplete,
        onFail: options.notifyOnFail ?? taskDef.defaultOptions?.notifyOnFail,
      },
    });
    
    console.log(chalk.green('✅ Task created and queued:'), chalk.gray(`ID: ${queuedTaskId}`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude status`), chalk.gray(`to check task status`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude results ${queuedTaskId}`), chalk.gray(`to download results when complete`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude logs ${queuedTaskId}`), chalk.gray(`to view execution logs`));
    console.log(chalk.gray(`Use`), chalk.blue(`rclaude cancel ${queuedTaskId}`), chalk.gray(`to cancel the task`));
    
    await taskManager.stop();
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Build compute configuration from CLI options, task defaults, and config
 */
function buildComputeConfig(options: RunOptions, taskDef: TaskDefinition, configManager: ConfigManagerV2): ComputeConfig {
  const provider = options.provider?.toLowerCase() || 
                   taskDef.defaultOptions?.provider || 
                   configManager.getDefaultBackend();

  switch (provider) {
    case ComputeProviderType.CODESPACE:
    case 'codespace':
      return {
        provider: ComputeProviderType.CODESPACE,
        codespace: {
          defaultMachine: options.machineType || 
                         taskDef.defaultOptions?.machineType || 
                         configManager.get('github.defaultMachine') || 
                         'basicLinux32gb',
          defaultIdleTimeout: options.idleTimeout || 
                             taskDef.defaultOptions?.idleTimeout || 
                             configManager.get('github.defaultIdleTimeout') || 
                             30,
          repository: taskDef.repository,
        }
      };

    case 'ec2':
      return {
        provider: 'ec2' as any,
        ec2: {
          region: options.ec2Region || 
                  taskDef.defaultOptions?.ec2Region || 
                  configManager.get('ec2.region') || 
                  'us-east-1',
          instanceType: options.ec2InstanceType || 
                        taskDef.defaultOptions?.ec2InstanceType || 
                        configManager.get('ec2.instanceType') || 
                        't3.medium',
          spotInstance: options.ec2Spot ?? 
                        configManager.get('ec2.spotInstance') ?? 
                        false,
          idleTimeout: options.idleTimeout || 
                       taskDef.defaultOptions?.idleTimeout || 
                       configManager.get('ec2.idleTimeout') || 
                       60,
          autoTerminate: true,
          tags: {
            Project: 'remote-claude',
            Environment: 'task-execution',
            TaskId: taskDef.id,
            TaskName: taskDef.name
          }
        }
      };

    case ComputeProviderType.AWS:
    case 'aws':
      // Handle unified AWS backend
      const awsMode = options.awsMode || configManager.getAWSMode();
      
      // Map AWS mode to specific provider
      let mappedProvider: string;
      switch (awsMode) {
        case 'ec2':
          // Use the existing EC2 provider configuration
          return buildComputeConfig({ ...options, provider: 'ec2' }, taskDef, configManager);
        case 'ecs':
          mappedProvider = 'aws';
          break;
        default:
          mappedProvider = 'aws'; // Default to ECS
      }
      
      return {
        provider: mappedProvider as any,
        // Include AWS-specific configuration
        aws: {
          mode: awsMode,
          region: configManager.get('aws.region') || 'us-east-1',
        },
        ...taskDef.defaultOptions,
      };

    case ComputeProviderType.FLY:
    case 'fly':
      // For legacy providers, we'll use a simplified config structure
      // The provider factory will handle the specific configurations
      return {
        provider: provider as any, // These are new provider types
        // Include any provider-specific options from task defaults
        ...taskDef.defaultOptions,
      };

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function createRunCommand(): Command {
  const command = new Command('run');
  
  return command
    .description('Execute a Claude Code task remotely')
    .argument('<task-id>', 'The task ID to execute (will prompt to create if not found)')
    .option('-r, --repo <repository>', 'GitHub repository (owner/repo)')
    .option('-b, --branch <branch>', 'Git branch to use')
    .option('-t, --timeout <seconds>', 'Task timeout in seconds', '7200')
    .option('-p, --priority <level>', 'Task priority (low, normal, high, urgent)', 'normal')
    .option('-i, --interactive', 'Run in interactive mode (connects directly to codespace)')
    .option('--session-id <id>', 'Custom session ID for interactive sessions (alphanumeric with hyphens)')
    .option('--persistent', 'Enable persistent session with tmux (default for interactive)')
    .option('--no-persistent', 'Disable persistent session setup')
    .option('--idle-timeout <minutes>', 'Codespace idle timeout in minutes (30-1440)', (val) => parseInt(val))
    .option('--machine-type <type>', 'Codespace machine type (basicLinux32gb, standardLinux32gb, premiumLinux)', 'basicLinux32gb')
    .option('--provider <type>', 'Compute provider (codespace, aws, fly)')
    .option('--aws-mode <mode>', 'AWS deployment mode (ec2, ecs, shared)')
    .option('--ec2-instance-type <type>', 'EC2 instance type (t3.medium, c5.xlarge, etc.)')
    .option('--ec2-spot', 'Use EC2 spot instances for cost savings')
    .option('--ec2-region <region>', 'EC2 region (us-east-1, us-west-2, etc.)')
    .option('-n, --notify <channels>', 'Notification channels (comma-separated)')
    .option('--notify-on-start', 'Send notification when task starts')
    .option('--notify-on-complete', 'Send notification when task completes')
    .option('--notify-on-fail', 'Send notification when task fails')
    .option('--auto-commit', 'Automatically commit changes')
    .option('--pull-request', 'Create pull request for changes')
    .option('-o, --output <files>', 'Expected output files (comma-separated)')
    .option('--name <name>', 'Custom name for the task')
    .option('-v, --verbose', 'Show detailed logs during execution')
    .action(runCommand);
}