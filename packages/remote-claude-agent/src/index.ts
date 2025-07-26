import { RemoteClaudeAgent } from './agent'
import { logger } from './utils/logger'

const PORT = parseInt(process.env.AGENT_PORT || '8080', 10)

async function main() {
  logger.info('Starting Remote Claude Agent', { port: PORT })
  
  const agent = new RemoteClaudeAgent()
  
  try {
    await agent.start(PORT)
    logger.info('Remote Claude Agent started successfully')
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully')
      await agent.stop()
      process.exit(0)
    })
    
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully')
      await agent.stop()
      process.exit(0)
    })
  } catch (error) {
    logger.error('Failed to start agent', { error })
    process.exit(1)
  }
}

main().catch((error) => {
  logger.error('Unhandled error', { error })
  process.exit(1)
})

export { RemoteClaudeAgent }