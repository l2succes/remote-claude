import { Command } from 'commander'
import chalk from 'chalk'
import { ECSExecWebSocket, ECSExecWebSocketClient } from '../../services/websocket/ecs-exec-websocket'
import { Config } from '../../utils/config'
import { ConfigManagerV2 } from '../../cli/utils/config-v2'

export function createWebSocketCommand(): Command {
  const websocket = new Command('websocket')
    .alias('ws')
    .description('WebSocket commands for ECS Exec')
  
  websocket
    .command('server')
    .description('Start WebSocket server for ECS Exec')
    .option('-p, --port <port>', 'WebSocket server port', '8080')
    .option('-t, --task <task>', 'ECS task ARN')
    .option('-c, --cluster <cluster>', 'ECS cluster name')
    .option('--container <container>', 'Container name', 'claude-code')
    .option('-r, --region <region>', 'AWS region', 'us-east-1')
    .action(async (options) => {
      try {
        // Initialize config if not provided
        if (!options.cluster) {
          const configManagerV2 = new ConfigManagerV2()
          const mergedConfig = configManagerV2.getMergedConfig()
          Config.initialize(mergedConfig)
          
          options.cluster = Config.get('aws.ecs.clusterName', 'remote-claude')
        }
        
        if (!options.task) {
          console.error(chalk.red('❌ Task ARN is required'))
          console.log(chalk.yellow('Use: rclaude ecs list to find running tasks'))
          process.exit(1)
        }
        
        console.log(chalk.blue('🚀 Starting ECS Exec WebSocket server...'))
        console.log(chalk.gray(`Port: ${options.port}`))
        console.log(chalk.gray(`Cluster: ${options.cluster}`))
        console.log(chalk.gray(`Task: ${options.task}`))
        console.log(chalk.gray(`Container: ${options.container}`))
        
        const server = new ECSExecWebSocket({
          cluster: options.cluster,
          taskArn: options.task,
          container: options.container,
          region: options.region,
          port: parseInt(options.port)
        })
        
        // Handle shutdown
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n🛑 Shutting down WebSocket server...'))
          server.close()
          process.exit(0)
        })
        
        console.log(chalk.green(`\n✅ WebSocket server is running on ws://localhost:${options.port}`))
        console.log(chalk.gray('Press Ctrl+C to stop'))
        
      } catch (error) {
        console.error(chalk.red('❌ Failed to start WebSocket server:'), error)
        process.exit(1)
      }
    })
  
  websocket
    .command('client <url>')
    .description('Connect to ECS Exec WebSocket server')
    .option('-c, --command <cmd>', 'Command to execute')
    .action(async (url, options) => {
      try {
        console.log(chalk.blue(`🔌 Connecting to ${url}...`))
        
        const client = new ECSExecWebSocketClient(url)
        await client.connect()
        
        if (options.command) {
          // Execute command and exit
          client.execute(options.command)
          
          // Wait for command to complete
          setTimeout(() => {
            client.disconnect()
            process.exit(0)
          }, 5000)
        } else {
          // Interactive mode - read from stdin
          console.log(chalk.green('✅ Connected! Type commands to execute:'))
          
          process.stdin.on('data', (data) => {
            const command = data.toString().trim()
            if (command) {
              client.execute(command)
            }
          })
          
          // Handle Ctrl+C
          process.on('SIGINT', () => {
            console.log(chalk.yellow('\n🛑 Disconnecting...'))
            client.disconnect()
            process.exit(0)
          })
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Failed to connect:'), error)
        process.exit(1)
      }
    })
  
  websocket
    .command('test')
    .description('Test WebSocket connectivity')
    .action(async () => {
      try {
        console.log(chalk.blue('🧪 Testing WebSocket connectivity...'))
        
        // Start a local test server
        const server = new ECSExecWebSocket({
          cluster: 'test-cluster',
          taskArn: 'arn:aws:ecs:us-east-1:123456789:task/test-task',
          container: 'test-container',
          port: 9999
        })
        
        // Connect a test client
        const client = new ECSExecWebSocketClient('ws://localhost:9999')
        await client.connect()
        
        console.log(chalk.green('✅ WebSocket test successful!'))
        
        // Clean up
        client.disconnect()
        server.close()
        process.exit(0)
        
      } catch (error) {
        console.error(chalk.red('❌ WebSocket test failed:'), error)
        process.exit(1)
      }
    })
  
  return websocket
}