/**
 * EC2 management commands
 */

import { Command } from 'commander'
import { chalk } from '@remote-claude/ui'
import { ConfigManager } from '@remote-claude/config'
import { EC2Provider, ComputeProviderType } from '@remote-claude/core'
import { spawn } from 'child_process'

export interface EC2ListOptions {
  all?: boolean
  status?: string
  json?: boolean
}

export interface EC2ConnectOptions {
  user?: string
  command?: string
  forwardAgent?: boolean
}

export interface EC2CostsOptions {
  timeframe?: string
  detailed?: boolean
}

/**
 * List EC2 instances
 */
export async function listInstances(options: EC2ListOptions): Promise<void> {
  try {
    console.log(chalk.blue('📋 Remote Claude EC2 Instances\n'))

    const configManager = new ConfigManager()
    const ec2Config = configManager.get('ec2') as any || {}
    
    // Ensure required fields for EC2Provider
    const providerConfig = {
      region: ec2Config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      instanceType: ec2Config.instanceType || 't3.micro',
      ...ec2Config
    }

    const provider = new EC2Provider(providerConfig)
    
    console.log(chalk.gray(`Region: ${providerConfig.region}`))
    console.log(chalk.gray(`Filter: ${options.all ? 'All instances' : 'Remote Claude instances only'}\n`))

    const environments = await provider.listEnvironments()
    
    if (environments.length === 0) {
      console.log(chalk.yellow('No Remote Claude EC2 instances found'))
      console.log(chalk.gray('Run'), chalk.blue('rclaude run "task" --provider ec2'), chalk.gray('to create one'))
      return
    }

    // Filter by status if specified
    const filteredEnvs = options.status 
      ? environments.filter(env => env.status.toLowerCase() === options.status?.toLowerCase())
      : environments

    if (options.json) {
      console.log(JSON.stringify(filteredEnvs, null, 2))
      return
    }

    // Display in table format
    console.log(chalk.bold('Instance ID'.padEnd(20) + 'Status'.padEnd(12) + 'Type'.padEnd(15) + 'IP Address'.padEnd(16) + 'Name'.padEnd(25) + 'Created'))
    console.log('─'.repeat(100))

    for (const env of filteredEnvs) {
      const statusColor = env.status === 'running' ? chalk.green : 
                         env.status === 'stopped' ? chalk.red :
                         env.status === 'creating' ? chalk.yellow : chalk.gray

      const instanceId = env.id.padEnd(20)
      const status = statusColor(env.status.padEnd(12))
      const instanceType = (env.metadata.instanceType || 'unknown').padEnd(15)
      const ipAddress = (env.metadata.publicIp || env.metadata.privateIp || 'pending').padEnd(16)
      const name = (env.metadata.displayName || 'unnamed').padEnd(25)
      const created = env.createdAt.toLocaleDateString().padEnd(12)

      console.log(`${instanceId}${status}${instanceType}${ipAddress}${name}${created}`)
    }

    console.log('\n' + chalk.gray(`Found ${filteredEnvs.length} instances`))
    
    if (filteredEnvs.some(env => env.status === 'running')) {
      console.log('\n' + chalk.blue('💡 Connect to an instance:'))
      console.log(chalk.gray('   rclaude ec2 connect <instance-id>'))
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to list instances:'), (error as Error).message)
    
    if ((error as Error).message.includes('credentials')) {
      console.error(chalk.yellow('💡 Configure AWS credentials: aws configure'))
    }
    
    process.exit(1)
  }
}

/**
 * Connect to an EC2 instance
 */
export async function connectToInstance(instanceId: string, options: EC2ConnectOptions): Promise<void> {
  try {
    console.log(chalk.blue(`🔗 Connecting to EC2 instance ${instanceId}...`))

    const configManager = new ConfigManager()
    const ec2Config = configManager.get('ec2') as any || {}
    
    // Ensure required fields for EC2Provider
    const providerConfig = {
      region: ec2Config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      instanceType: ec2Config.instanceType || 't3.micro',
      ...ec2Config
    }

    const provider = new EC2Provider(providerConfig)
    
    // Get instance details
    const environments = await provider.listEnvironments()
    const environment = environments.find(env => env.id === instanceId)
    
    if (!environment) {
      console.error(chalk.red(`❌ Instance ${instanceId} not found or not a Remote Claude instance`))
      process.exit(1)
    }

    if (environment.status !== 'running') {
      console.error(chalk.red(`❌ Instance ${instanceId} is not running (status: ${environment.status})`))
      process.exit(1)
    }

    const publicIp = environment.metadata.publicIp
    const keyPair = providerConfig.keyPair || environment.metadata.keyPair
    
    if (!publicIp) {
      console.error(chalk.red('❌ Instance has no public IP address'))
      process.exit(1)
    }

    if (!keyPair) {
      console.error(chalk.red('❌ No SSH key pair configured'))
      console.error(chalk.yellow('💡 Configure key pair: rclaude config ec2 --key-pair your-key-name'))
      process.exit(1)
    }

    console.log(chalk.gray(`   Instance: ${instanceId}`))
    console.log(chalk.gray(`   Public IP: ${publicIp}`))
    console.log(chalk.gray(`   User: ${options.user || 'ec2-user'}`))
    console.log(chalk.gray(`   Key: ${keyPair}`))

    // Check if key file exists
    const keyPath = `${process.env.HOME}/.ssh/${keyPair}.pem`
    const fs = await import('fs/promises')
    
    try {
      await fs.access(keyPath)
    } catch {
      console.error(chalk.red(`❌ SSH key not found: ${keyPath}`))
      console.error(chalk.yellow('💡 Make sure your SSH key is saved in ~/.ssh/'))
      process.exit(1)
    }

    // Build SSH command
    const user = options.user || 'ec2-user'
    const command = options.command || 'bash'
    
    const sshArgs = [
      '-i', keyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=quiet',
      ...(options.forwardAgent ? ['-A'] : []),
      `${user}@${publicIp}`
    ]

    if (options.command) {
      sshArgs.push(command)
    }

    console.log(chalk.green('\n✅ Establishing SSH connection...'))
    console.log(chalk.gray('💡 Use Ctrl+D or type "exit" to disconnect\n'))

    // Spawn SSH process
    const ssh = spawn('ssh', sshArgs, {
      stdio: 'inherit',
      env: process.env
    })

    ssh.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.gray('\n👋 SSH session ended'))
      } else {
        console.error(chalk.red(`\n❌ SSH session ended with code ${code}`))
      }
    })

    ssh.on('error', (error) => {
      console.error(chalk.red('❌ SSH connection failed:'), error.message)
      
      if (error.message.includes('ENOENT')) {
        console.error(chalk.yellow('💡 Make sure SSH is installed: which ssh'))
      }
    })

  } catch (error) {
    console.error(chalk.red('❌ Failed to connect:'), (error as Error).message)
    process.exit(1)
  }
}

/**
 * Show EC2 costs and usage
 */
export async function showCosts(options: EC2CostsOptions): Promise<void> {
  try {
    console.log(chalk.blue('💰 Remote Claude EC2 Costs\n'))

    const configManager = new ConfigManager()
    const ec2Config = configManager.get('ec2') as any || {}

    // Ensure required fields for EC2Provider
    const providerConfig = {
      region: ec2Config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      instanceType: ec2Config.instanceType || 't3.micro',
      ...ec2Config
    }

    // For now, show a simple cost estimation based on running instances
    // In production, this would integrate with AWS Cost Explorer API
    
    const provider = new EC2Provider(providerConfig)
    const environments = await provider.listEnvironments()
    const runningInstances = environments.filter(env => env.status === 'running')

    console.log(chalk.bold('Current Running Instances:'))
    
    if (runningInstances.length === 0) {
      console.log(chalk.gray('No instances currently running'))
      console.log(chalk.green('💡 Current hourly cost: $0.00'))
      return
    }

    let totalHourlyCost = 0
    console.log('\nInstance ID'.padEnd(20) + 'Type'.padEnd(15) + 'Runtime'.padEnd(15) + 'Cost/Hour'.padEnd(12) + 'Estimated Cost')
    console.log('─'.repeat(80))

    for (const env of runningInstances) {
      const instanceType = env.metadata.instanceType || 'unknown'
      const runtime = Math.max(1, Math.round((Date.now() - env.createdAt.getTime()) / (1000 * 60))) // minutes
      
      // Rough cost estimates (these should be fetched from AWS pricing API)
      const costPerHour = getCostPerHour(instanceType)
      const estimatedCost = (runtime / 60) * costPerHour
      totalHourlyCost += costPerHour

      console.log(
        env.id.padEnd(20) +
        instanceType.padEnd(15) +
        `${runtime}m`.padEnd(15) +
        `$${costPerHour.toFixed(4)}`.padEnd(12) +
        `$${estimatedCost.toFixed(4)}`
      )
    }

    console.log('─'.repeat(80))
    console.log(chalk.bold(`Total current hourly rate: $${totalHourlyCost.toFixed(4)}`))
    
    const dailyCost = totalHourlyCost * 24
    const monthlyCost = dailyCost * 30
    
    console.log(chalk.gray(`Estimated daily cost (if left running): $${dailyCost.toFixed(2)}`))
    console.log(chalk.gray(`Estimated monthly cost (if left running): $${monthlyCost.toFixed(2)}`))

    console.log('\n' + chalk.yellow('⚠️  These are rough estimates. Check AWS billing for exact costs.'))
    console.log(chalk.blue('💡 Use --ec2-spot for 60-90% cost savings on non-critical tasks'))

    if (options.detailed) {
      console.log('\n' + chalk.bold('Cost Optimization Tips:'))
      console.log('• Use spot instances: --ec2-spot')
      console.log('• Set idle timeouts: --idle-timeout 30')
      console.log('• Use smaller instances: --ec2-instance-type t3.micro')
      console.log('• Clean up unused instances: rclaude ec2 list')
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to get costs:'), (error as Error).message)
    process.exit(1)
  }
}

/**
 * Copy SSH key to EC2 instance
 */
export async function copySSHKey(instanceId: string, options: {
  publicKey?: string;
  privateKey?: string;
  setupGithub?: boolean;
}): Promise<void> {
  try {
    console.log(chalk.blue(`🔑 Setting up SSH key access for ${instanceId}...`));

    const configManager = new ConfigManager();
    const ec2Config = configManager.get('ec2') as any || {};
    
    const providerConfig = {
      region: ec2Config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      instanceType: ec2Config.instanceType || 't3.micro',
      ...ec2Config
    };

    const provider = new EC2Provider(providerConfig);
    
    // Get instance details
    const environments = await provider.listEnvironments();
    const environment = environments.find(env => env.id === instanceId);
    
    if (!environment) {
      console.error(chalk.red(`❌ Instance ${instanceId} not found or not a Remote Claude instance`));
      process.exit(1);
    }

    if (environment.status !== 'running') {
      console.error(chalk.red(`❌ Instance ${instanceId} is not running (status: ${environment.status})`));
      process.exit(1);
    }

    // Copy SSH key
    await provider.copySSHKey(environment, {
      ...(options.publicKey && { publicKeyPath: options.publicKey }),
      ...(options.privateKey && { privateKeyPath: options.privateKey }),
      ...(options.setupGithub && { setupGitHubAccess: options.setupGithub })
    });

    console.log(chalk.green('✅ SSH key setup complete!'));
    
    if (options.setupGithub) {
      console.log(chalk.blue('🔍 Testing GitHub access...'));
      try {
        const result = await provider.executeTask(environment, {
          id: 'test-github',
          command: 'ssh -T git@github.com'
        });
        if (result.output?.includes('successfully authenticated')) {
          console.log(chalk.green('✅ GitHub access working!'));
        } else {
          console.log(chalk.yellow('⚠️  GitHub access test inconclusive'));
        }
      } catch {
        console.log(chalk.yellow('⚠️  Could not test GitHub access'));
      }
    }

    console.log(chalk.gray('\n💡 Next steps:'));
    console.log(chalk.blue(`   ssh ec2-user@${environment.metadata.publicIp}`));
    if (options.setupGithub) {
      console.log(chalk.blue('   git clone git@github.com:owner/repo.git'));
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to set up SSH key:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Terminate EC2 instances
 */
export async function terminateInstance(instanceId: string): Promise<void> {
  try {
    console.log(chalk.blue(`🛑 Terminating EC2 instance ${instanceId}...`))

    const configManager = new ConfigManager()
    const ec2Config = configManager.get('ec2') as any || {}

    // Ensure required fields for EC2Provider
    const providerConfig = {
      region: ec2Config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      instanceType: ec2Config.instanceType || 't3.micro',
      ...ec2Config
    }

    const provider = new EC2Provider(providerConfig)
    
    // Verify instance exists
    const environments = await provider.listEnvironments()
    const environment = environments.find(env => env.id === instanceId)
    
    if (!environment) {
      console.error(chalk.red(`❌ Instance ${instanceId} not found or not a Remote Claude instance`))
      process.exit(1)
    }

    console.log(chalk.gray(`   Instance: ${instanceId}`))
    console.log(chalk.gray(`   Name: ${environment.metadata.displayName || 'unnamed'}`))
    console.log(chalk.gray(`   Status: ${environment.status}`))

    await provider.destroyEnvironment(instanceId)
    
    console.log(chalk.green('✅ Instance termination initiated'))
    console.log(chalk.gray('💡 It may take a few minutes for the instance to fully terminate'))

  } catch (error) {
    console.error(chalk.red('❌ Failed to terminate instance:'), (error as Error).message)
    process.exit(1)
  }
}

/**
 * Get rough cost per hour for instance types
 */
function getCostPerHour(instanceType: string): number {
  const costs: Record<string, number> = {
    't3.nano': 0.0052,
    't3.micro': 0.0104,
    't3.small': 0.0208,
    't3.medium': 0.0416,
    't3.large': 0.0832,
    't3.xlarge': 0.1664,
    't3.2xlarge': 0.3328,
    
    't4g.nano': 0.0042,
    't4g.micro': 0.0084,
    't4g.small': 0.0168,
    't4g.medium': 0.0336,
    't4g.large': 0.0672,
    
    'c5.large': 0.085,
    'c5.xlarge': 0.17,
    'c5.2xlarge': 0.34,
    'c5.4xlarge': 0.68,
    
    'm5.large': 0.096,
    'm5.xlarge': 0.192,
    'm5.2xlarge': 0.384,
    
    'r5.large': 0.126,
    'r5.xlarge': 0.252,
    'r5.2xlarge': 0.504
  }
  
  return costs[instanceType] || 0.05 // Default estimate
}

/**
 * Create EC2 command structure
 */
export function createEC2Command(): Command {
  const ec2Command = new Command('ec2')
    .description('Manage EC2 instances for Remote Claude')

  // List command
  ec2Command
    .command('list')
    .alias('ls')
    .description('List Remote Claude EC2 instances')
    .option('-a, --all', 'Show all instances (not just Remote Claude)')
    .option('-s, --status <status>', 'Filter by status (running, stopped, etc.)')
    .option('--json', 'Output in JSON format')
    .action(listInstances)

  // Connect command
  ec2Command
    .command('connect <instance-id>')
    .alias('ssh')
    .description('Connect to an EC2 instance via SSH')
    .option('-u, --user <username>', 'SSH username', 'ec2-user')
    .option('-c, --command <command>', 'Run specific command instead of interactive shell')
    .option('-A, --forward-agent', 'Enable SSH agent forwarding for Git access')
    .action(connectToInstance)

  // Costs command
  ec2Command
    .command('costs')
    .alias('cost')
    .description('Show EC2 costs and usage')
    .option('-t, --timeframe <period>', 'Time period (1d, 7d, 30d)', '1d')
    .option('-d, --detailed', 'Show detailed cost breakdown and tips')
    .action(showCosts)

  // SSH key command
  ec2Command
    .command('copy-ssh-key <instance-id>')
    .alias('ssh-key')
    .description('Copy SSH key to EC2 instance for passwordless access')
    .option('--public-key <path>', 'Path to public key file')
    .option('--private-key <path>', 'Path to private key file (for GitHub access)')
    .option('--setup-github', 'Set up GitHub SSH access using private key')
    .action(copySSHKey)

  // Terminate command
  ec2Command
    .command('terminate <instance-id>')
    .alias('stop')
    .description('Terminate an EC2 instance')
    .action(terminateInstance)

  return ec2Command
}