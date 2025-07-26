import { Command } from 'commander'
import chalk from 'chalk'
import { ProviderFactory } from '../../services/compute/providers/provider-factory'
import { spawn } from 'child_process'

/**
 * List ECS sessions
 */
export async function listECSSessions(): Promise<void> {
  try {
    console.log(chalk.blue('📋 Remote Claude ECS Sessions\n'))
    
    // Initialize provider factory
    await ProviderFactory.initialize()
    const provider = await ProviderFactory.getProvider('aws')
    
    // List sessions
    const sessions = await provider.listSessions()
    
    if (sessions.length === 0) {
      console.log(chalk.yellow('No active ECS sessions found'))
      console.log(chalk.gray('Run'), chalk.blue('rclaude run <task> --provider aws'), chalk.gray('to create one'))
      return
    }
    
    console.log(chalk.bold('Session ID'.padEnd(25) + 'Status'.padEnd(12) + 'Task ARN'))
    console.log('─'.repeat(80))
    
    for (const session of sessions) {
      const sessionId = session.id.padEnd(25)
      const status = chalk.green(session.status.padEnd(12))
      const taskArn = session.metadata?.taskArn || 'N/A'
      
      console.log(`${sessionId}${status}${taskArn}`)
    }
    
    console.log('\n' + chalk.gray(`Found ${sessions.length} sessions`))
    console.log('\n' + chalk.blue('💡 To connect to a session:'))
    console.log(chalk.gray('   rclaude ecs connect <session-id>'))
    
    await ProviderFactory.shutdown()
  } catch (error) {
    console.error(chalk.red('❌ Failed to list sessions:'), (error as Error).message)
    process.exit(1)
  }
}

/**
 * Connect to an ECS session
 */
export async function connectToECSSession(sessionId: string): Promise<void> {
  try {
    console.log(chalk.blue(`🔗 Connecting to ECS session ${sessionId}...`))
    
    // Initialize provider factory
    await ProviderFactory.initialize()
    const provider = await ProviderFactory.getProvider('aws')
    
    // Get session details
    const sessions = await provider.listSessions()
    const session = sessions.find(s => s.id === sessionId)
    
    if (!session) {
      console.error(chalk.red(`❌ Session ${sessionId} not found`))
      process.exit(1)
    }
    
    const taskArn = session.metadata?.taskArn
    const clusterArn = session.metadata?.clusterArn
    
    if (!taskArn || !clusterArn) {
      console.error(chalk.red('❌ Session missing required metadata'))
      process.exit(1)
    }
    
    // Extract cluster name from ARN
    const clusterName = clusterArn.split('/').pop() || 'remote-claude-cluster'
    
    // Use AWS CLI to connect
    const args = [
      'ecs',
      'execute-command',
      '--cluster', clusterName,
      '--task', taskArn,
      '--container', 'claude-code',
      '--interactive',
      '--command', '/usr/local/bin/claude-start.sh || /bin/bash'
    ]
    
    console.log(chalk.green('✅ Establishing ECS Exec connection...'))
    console.log(chalk.gray('💡 Claude Code will start automatically\n'))
    
    const awsProcess = spawn('aws', args, {
      stdio: 'inherit',
      env: process.env
    })
    
    awsProcess.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.gray('\n👋 ECS session ended'))
      } else {
        console.error(chalk.red(`\n❌ ECS session ended with code ${code}`))
      }
      ProviderFactory.shutdown()
    })
    
    awsProcess.on('error', (error) => {
      console.error(chalk.red('❌ Failed to connect:'), error.message)
      ProviderFactory.shutdown()
    })
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to connect:'), (error as Error).message)
    await ProviderFactory.shutdown()
    process.exit(1)
  }
}

/**
 * Terminate an ECS session
 */
export async function terminateECSSession(sessionId: string): Promise<void> {
  try {
    console.log(chalk.blue(`🗑️  Terminating ECS session ${sessionId}...`))
    
    // Initialize provider factory
    await ProviderFactory.initialize()
    const provider = await ProviderFactory.getProvider('aws')
    
    // Terminate session
    await provider.terminateSession(sessionId)
    
    console.log(chalk.green(`✅ Session ${sessionId} terminated`))
    
    await ProviderFactory.shutdown()
  } catch (error) {
    console.error(chalk.red('❌ Failed to terminate session:'), (error as Error).message)
    await ProviderFactory.shutdown()
    process.exit(1)
  }
}

/**
 * Create ECS command
 */
export function createECSCommand(): Command {
  const ecsCommand = new Command('ecs')
    .description('Manage ECS sessions')
  
  // List command
  ecsCommand
    .command('list')
    .alias('ls')
    .description('List active ECS sessions')
    .action(listECSSessions)
  
  // Connect command
  ecsCommand
    .command('connect <session-id>')
    .description('Connect to an ECS session')
    .action(connectToECSSession)
  
  // Terminate command
  ecsCommand
    .command('terminate <session-id>')
    .alias('stop')
    .description('Terminate an ECS session')
    .action(terminateECSSession)
  
  return ecsCommand
}