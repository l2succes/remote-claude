#!/usr/bin/env node

import { RemoteClaudeAgent } from './agent'
import chalk from 'chalk'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const DEFAULT_PORT = process.env.AGENT_PORT ? parseInt(process.env.AGENT_PORT) : 8080
const DEFAULT_HOST = process.env.AGENT_HOST || '0.0.0.0'

async function main() {
  console.log(chalk.blue('🤖 Remote Claude Agent Starting...'))
  console.log(chalk.gray(`Version: 0.1.0`))
  console.log(chalk.gray(`Node: ${process.version}`))
  console.log(chalk.gray(`Platform: ${process.platform}`))
  console.log(chalk.gray(`Working Directory: ${process.cwd()}`))
  
  const agent = new RemoteClaudeAgent({
    port: DEFAULT_PORT,
    host: DEFAULT_HOST,
    workDir: process.cwd()
  })
  
  try {
    await agent.start()
    console.log(chalk.green(`✅ Agent running on ${DEFAULT_HOST}:${DEFAULT_PORT}`))
    
    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down agent...'))
      await agent.stop()
      process.exit(0)
    })
    
    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down...'))
      await agent.stop()
      process.exit(0)
    })
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start agent:'), error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { RemoteClaudeAgent } from './agent'
export { FileSystemAPI } from './services/file-system'
export { CommandExecutor } from './services/command-executor'
export { StreamManager } from './services/stream-manager'