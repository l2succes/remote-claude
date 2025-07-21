import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManagerV2 } from '../utils/config-v2';

interface BackendOptions {
  global?: boolean;
  project?: boolean;
}

export async function configBackendCommand(backend?: string, options?: BackendOptions): Promise<void> {
  try {
    const configManager = new ConfigManagerV2();
    const scope = options?.project ? 'project' : 'global';
    
    let selectedBackend = backend;
    
    // If no backend specified, show interactive menu
    if (!selectedBackend) {
      const currentBackend = configManager.getDefaultBackend();
      console.log(chalk.blue('🔧 Configure Default Backend'));
      console.log(chalk.gray(`Current default: ${currentBackend}`));
      console.log();
      
      const response = await inquirer.prompt([{
        type: 'list',
        name: 'selectedBackend',
        message: 'Select default compute backend:',
        choices: [
          {
            name: 'GitHub Codespaces - Cloud development environments',
            value: 'codespace',
            short: 'Codespaces',
          },
          {
            name: 'Amazon Web Services (AWS) - EC2, ECS, and more',
            value: 'aws',
            short: 'AWS',
          },
          {
            name: 'Fly.io - Edge computing (coming soon)',
            value: 'fly',
            disabled: true,
          },
          {
            name: 'Local - Run on this machine (coming soon)',
            value: 'local',
            disabled: true,
          },
        ],
        default: currentBackend,
      }]);
      
      selectedBackend = response.selectedBackend;
    }
    
    // Validate backend
    const validBackends = ['codespace', 'aws', 'fly', 'local'];
    if (!selectedBackend || !validBackends.includes(selectedBackend)) {
      console.error(chalk.red('❌ Invalid backend. Choose from: codespace, aws, fly'));
      process.exit(1);
    }
    
    // Set the backend
    await configManager.configureBackend(selectedBackend as 'codespace' | 'aws' | 'fly' | 'local', scope);
    
    // Show backend-specific configuration options
    console.log();
    
    if (selectedBackend === 'codespace') {
      const { configureCodespace } = await inquirer.prompt([{
        type: 'confirm',
        name: 'configureCodespace',
        message: 'Would you like to configure GitHub Codespaces settings?',
        default: true,
      }]);
      
      if (configureCodespace) {
        const codespaceConfig = await inquirer.prompt([
          {
            type: 'list',
            name: 'defaultMachine',
            message: 'Default machine type:',
            choices: [
              { name: 'Basic (2 cores, 8GB RAM, 32GB storage)', value: 'basicLinux32gb' },
              { name: 'Standard (4 cores, 16GB RAM, 32GB storage)', value: 'standardLinux32gb' },
              { name: 'Premium (8 cores, 32GB RAM, 64GB storage)', value: 'premiumLinux' },
            ],
            default: configManager.get('github.defaultMachine') || 'basicLinux32gb',
          },
          {
            type: 'number',
            name: 'defaultIdleTimeout',
            message: 'Default idle timeout (minutes):',
            default: configManager.get('github.defaultIdleTimeout') || 30,
            validate: (input) => {
              const num = parseInt(input);
              return (num >= 30 && num <= 1440) || 'Timeout must be between 30 and 1440 minutes';
            },
          },
        ]);
        
        await configManager.configureGitHub(codespaceConfig, scope);
      }
    } else if (selectedBackend === 'aws') {
      const { configureAWS } = await inquirer.prompt([{
        type: 'confirm',
        name: 'configureAWS',
        message: 'Would you like to configure AWS settings?',
        default: true,
      }]);
      
      if (configureAWS) {
        // First, select AWS mode
        const { awsMode } = await inquirer.prompt([{
          type: 'list',
          name: 'awsMode',
          message: 'Select AWS deployment mode:',
          choices: [
            {
              name: 'EC2 Instances - Simple VMs, one per task',
              value: 'ec2',
              short: 'EC2',
            },
            {
              name: 'ECS Containers - Scalable container orchestration (recommended)',
              value: 'ecs',
              short: 'ECS',
            },
            {
              name: 'Fargate - Serverless containers (coming soon)',
              value: 'fargate',
              disabled: true,
            },
          ],
          default: configManager.getAWSMode(),
        }]);
        
        // Common AWS settings
        const commonConfig = await inquirer.prompt([
          {
            type: 'list',
            name: 'region',
            message: 'AWS Region:',
            choices: [
              { name: 'US East (N. Virginia)', value: 'us-east-1' },
              { name: 'US East (Ohio)', value: 'us-east-2' },
              { name: 'US West (N. California)', value: 'us-west-1' },
              { name: 'US West (Oregon)', value: 'us-west-2' },
              { name: 'EU (Ireland)', value: 'eu-west-1' },
              { name: 'EU (Frankfurt)', value: 'eu-central-1' },
              { name: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
              { name: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
            ],
            default: configManager.get('aws.region') || configManager.get('ec2.region') || configManager.get('ecs.region') || 'us-east-1',
          },
        ]);
        
        let modeConfig: any = {};
        
        // Mode-specific configuration
        if (awsMode === 'ec2') {
          modeConfig = await inquirer.prompt([
            {
              type: 'list',
              name: 'instanceType',
              message: 'Default instance type:',
              choices: [
                { name: 't3.micro (1 vCPU, 1GB RAM) - Free tier', value: 't3.micro' },
                { name: 't3.small (2 vCPU, 2GB RAM)', value: 't3.small' },
                { name: 't3.medium (2 vCPU, 4GB RAM)', value: 't3.medium' },
                { name: 't3.large (2 vCPU, 8GB RAM)', value: 't3.large' },
                { name: 'c5.large (2 vCPU, 4GB RAM) - Compute optimized', value: 'c5.large' },
                { name: 'c5.xlarge (4 vCPU, 8GB RAM) - Compute optimized', value: 'c5.xlarge' },
              ],
              default: configManager.get('aws.ec2.instanceType') || configManager.get('ec2.instanceType') || 't3.medium',
            },
            {
              type: 'confirm',
              name: 'spotInstance',
              message: 'Use spot instances for cost savings?',
              default: configManager.get('aws.ec2.spotInstance') || configManager.get('ec2.spotInstance') || false,
            },
            {
              type: 'number',
              name: 'idleTimeout',
              message: 'Idle timeout before auto-termination (minutes):',
              default: configManager.get('aws.ec2.idleTimeout') || configManager.get('ec2.idleTimeout') || 60,
              validate: (input) => {
                const num = parseInt(input);
                return (num >= 5 && num <= 1440) || 'Timeout must be between 5 and 1440 minutes';
              },
            },
          ]);
        } else if (awsMode === 'ecs') {
          console.log(chalk.yellow('\n⚠️  Note: ECS requires running "rclaude init-deployment" first to create the infrastructure.'));
          
          modeConfig = await inquirer.prompt([
            {
              type: 'input',
              name: 'clusterName',
              message: 'ECS Cluster name:',
              default: configManager.get('aws.ecs.clusterName') || configManager.get('ecs.clusterName') || 'remote-claude-cluster',
            },
            {
              type: 'list',
              name: 'instanceType',
              message: 'Default instance type for ECS cluster:',
              choices: [
                { name: 't3.small (2 vCPU, 2GB RAM)', value: 't3.small' },
                { name: 't3.medium (2 vCPU, 4GB RAM) - Recommended', value: 't3.medium' },
                { name: 't3.large (2 vCPU, 8GB RAM)', value: 't3.large' },
                { name: 'c5.large (2 vCPU, 4GB RAM) - Compute optimized', value: 'c5.large' },
              ],
              default: configManager.get('aws.ecs.instanceType') || configManager.get('ecs.instanceType') || 't3.medium',
            },
          ]);
        }
        
        // Save configuration
        const awsConfig: any = {
          mode: awsMode,
          region: commonConfig.region,
        };
        
        if (awsMode === 'ec2') {
          awsConfig.ec2 = modeConfig;
        } else if (awsMode === 'ecs') {
          awsConfig.ecs = modeConfig;
        }
        
        await configManager.configureAWS(awsConfig, scope);
        
        // Show cost estimate for EC2 mode
        if (awsMode === 'ec2' && modeConfig.instanceType) {
          console.log();
          console.log(chalk.blue('💰 Estimated Costs (per instance):'));
          const costs: Record<string, { onDemand: number; spot: number }> = {
            't3.micro': { onDemand: 0.0104, spot: 0.0031 },
            't3.small': { onDemand: 0.0208, spot: 0.0062 },
            't3.medium': { onDemand: 0.0416, spot: 0.0125 },
            't3.large': { onDemand: 0.0832, spot: 0.025 },
            'c5.large': { onDemand: 0.085, spot: 0.0323 },
            'c5.xlarge': { onDemand: 0.17, spot: 0.0646 },
          };
          
          const cost = costs[modeConfig.instanceType] || { onDemand: 0, spot: 0 };
          const hourlyRate = modeConfig.spotInstance ? cost.spot : cost.onDemand;
          
          console.log(chalk.gray(`Instance: ${modeConfig.instanceType}`));
          console.log(chalk.gray(`Hourly rate: $${hourlyRate.toFixed(4)}/hour`));
          console.log(chalk.gray(`Daily cost (8 hours): $${(hourlyRate * 8).toFixed(2)}`));
          console.log(chalk.gray(`Monthly cost (160 hours): $${(hourlyRate * 160).toFixed(2)}`));
          
          if (modeConfig.spotInstance) {
            console.log(chalk.green(`Savings with spot: ~${Math.round((1 - cost.spot / cost.onDemand) * 100)}%`));
          }
        }
        
        // Show deployment instructions for ECS
        if (awsMode === 'ecs') {
          console.log();
          console.log(chalk.blue('📦 To deploy ECS infrastructure:'));
          console.log(chalk.gray('  rclaude init-deployment --mode self-hosted'));
        }
      }
    }
    
    // Show configuration summary
    console.log();
    console.log(chalk.green('✅ Backend configuration complete!'));
    console.log();
    console.log(chalk.blue('To use this backend, run:'));
    console.log(chalk.gray('  rclaude run <task-id>'));
    console.log();
    console.log(chalk.blue('To override for a specific task:'));
    console.log(chalk.gray('  rclaude run <task-id> --provider codespace'));
    console.log(chalk.gray('  rclaude run <task-id> --provider aws'));
    console.log(chalk.gray('  rclaude run <task-id> --provider aws --aws-mode ec2'));
    console.log(chalk.gray('  rclaude run <task-id> --provider aws --aws-mode ecs'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createConfigBackendCommand(): Command {
  const command = new Command('backend');
  
  return command
    .description('Configure default compute backend')
    .argument('[backend]', 'Backend to use (codespace, aws, fly)')
    .option('-g, --global', 'Set globally (default)')
    .option('-p, --project', 'Set for current project only')
    .action(configBackendCommand);
}