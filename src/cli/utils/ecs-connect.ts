import { spawn } from 'child_process'
import chalk from 'chalk'
import { checkSessionManagerPlugin } from '../../services/compute/providers/ecs-ec2/ecs-exec'

export interface ECSConnectOptions {
  cluster: string
  taskArn: string
  container?: string
  region?: string
}

/**
 * Connect interactively to an ECS container
 */
export async function connectToECSContainer(options: ECSConnectOptions): Promise<void> {
  const { cluster, taskArn, container = 'claude-code', region = 'us-east-1' } = options
  
  // Check if session-manager-plugin is installed
  const hasPlugin = await checkSessionManagerPlugin()
  if (!hasPlugin) {
    console.error(chalk.red('\n❌ AWS Session Manager Plugin is not installed'))
    console.log(chalk.yellow('\nThe Session Manager Plugin is required to connect to ECS containers.'))
    console.log(chalk.white('\nTo install it:'))
    console.log(chalk.gray('• macOS:    ') + chalk.white('brew install --cask session-manager-plugin'))
    console.log(chalk.gray('• Ubuntu:   ') + chalk.white('See AWS documentation below'))
    console.log(chalk.gray('• Windows:  ') + chalk.white('Download installer from AWS'))
    console.log(chalk.blue('\nFull instructions: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html'))
    process.exit(1)
  }
  
  // Extract task ID from ARN
  const taskId = taskArn.split('/').pop()
  
  console.log(chalk.blue('🔗 Connecting to ECS container...'))
  console.log(chalk.gray(`Cluster: ${cluster}`))
  console.log(chalk.gray(`Task: ${taskId}`))
  console.log(chalk.gray(`Container: ${container}`))
  
  // Build the AWS CLI command
  const args = [
    'ecs',
    'execute-command',
    '--cluster', cluster,
    '--task', taskArn,
    '--container', container,
    '--interactive',
    '--command', '/bin/bash',
    '--region', region
  ]
  
  // Spawn AWS CLI process
  const awsProcess = spawn('aws', args, {
    stdio: 'inherit',
    env: process.env
  })
  
  awsProcess.on('error', (error) => {
    if (error.message.includes('ENOENT')) {
      console.error(chalk.red('❌ AWS CLI is not installed'))
      console.log(chalk.yellow('Please install the AWS CLI:'))
      console.log(chalk.blue('https://aws.amazon.com/cli/'))
    } else {
      console.error(chalk.red('❌ Failed to connect:'), error.message)
    }
  })
  
  return new Promise((resolve, reject) => {
    awsProcess.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`AWS CLI exited with code ${code}`))
      }
    })
  })
}