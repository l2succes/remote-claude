import { Command } from 'commander';
import { chalk } from '@remote-claude/ui';
import { inquirer } from '@remote-claude/ui';
import { ConfigManagerV2 } from '@remote-claude/config';

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
            name: 'AWS EC2 - Scalable cloud compute instances',
            value: 'ec2',
            short: 'EC2',
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
    if (!selectedBackend || !['codespace', 'ec2', 'local'].includes(selectedBackend)) {
      console.error(chalk.red('❌ Invalid backend. Choose from: codespace, ec2'));
      process.exit(1);
    }
    
    // Set the backend
    await configManager.configureBackend(selectedBackend as 'codespace' | 'ec2' | 'local', scope);
    
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
    } else if (selectedBackend === 'ec2') {
      const { configureEC2 } = await inquirer.prompt([{
        type: 'confirm',
        name: 'configureEC2',
        message: 'Would you like to configure AWS EC2 settings?',
        default: true,
      }]);
      
      if (configureEC2) {
        const ec2Config = await inquirer.prompt([
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
            default: configManager.get('ec2.region') || 'us-east-1',
          },
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
            default: configManager.get('ec2.instanceType') || 't3.medium',
          },
          {
            type: 'confirm',
            name: 'spotInstance',
            message: 'Use spot instances for cost savings?',
            default: configManager.get('ec2.spotInstance') || false,
          },
          {
            type: 'number',
            name: 'idleTimeout',
            message: 'Idle timeout before auto-termination (minutes):',
            default: configManager.get('ec2.idleTimeout') || 60,
            validate: (input) => {
              const num = parseInt(input);
              return (num >= 5 && num <= 1440) || 'Timeout must be between 5 and 1440 minutes';
            },
          },
        ]);
        
        await configManager.configureEC2(ec2Config, scope);
        
        // Show cost estimate
        console.log();
        console.log(chalk.blue('💰 Estimated Costs:'));
        const instanceType = ec2Config.instanceType;
        const costs: Record<string, { onDemand: number; spot: number }> = {
          't3.micro': { onDemand: 0.0104, spot: 0.0031 },
          't3.small': { onDemand: 0.0208, spot: 0.0062 },
          't3.medium': { onDemand: 0.0416, spot: 0.0125 },
          't3.large': { onDemand: 0.0832, spot: 0.025 },
          'c5.large': { onDemand: 0.085, spot: 0.0323 },
          'c5.xlarge': { onDemand: 0.17, spot: 0.0646 },
        };
        
        const cost = costs[instanceType] || { onDemand: 0, spot: 0 };
        const hourlyRate = ec2Config.spotInstance ? cost.spot : cost.onDemand;
        
        console.log(chalk.gray(`Instance: ${instanceType}`));
        console.log(chalk.gray(`Hourly rate: $${hourlyRate.toFixed(4)}/hour`));
        console.log(chalk.gray(`Daily cost (8 hours): $${(hourlyRate * 8).toFixed(2)}`));
        console.log(chalk.gray(`Monthly cost (160 hours): $${(hourlyRate * 160).toFixed(2)}`));
        
        if (ec2Config.spotInstance) {
          console.log(chalk.green(`Savings with spot: ~${Math.round((1 - cost.spot / cost.onDemand) * 100)}%`));
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
    console.log(chalk.gray('  rclaude run <task-id> --provider ec2'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}

export function createConfigBackendCommand(): Command {
  const command = new Command('backend');
  
  return command
    .description('Configure default compute backend')
    .argument('[backend]', 'Backend to use (codespace, ec2)')
    .option('-g, --global', 'Set globally (default)')
    .option('-p, --project', 'Set for current project only')
    .action(configBackendCommand);
}