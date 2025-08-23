import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import chalk from 'chalk'

export interface ECSExecWebSocketOptions {
  cluster: string
  taskArn: string
  container?: string
  region?: string
  port?: number
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

/**
 * WebSocket server for ECS Exec command execution
 */
export class ECSExecWebSocket extends EventEmitter {
  private wss: WebSocket.Server
  private sessions: Map<string, ChildProcess> = new Map()
  
  constructor(private options: ECSExecWebSocketOptions) {
    super()
    const port = options.port || 8080
    
    this.wss = new WebSocket.Server({ port })
    this.setupWebSocketServer()
    
    console.log(chalk.green(`🔌 WebSocket server listening on port ${port}`))
  }
  
  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      const sessionId = this.generateSessionId()
      console.log(chalk.blue(`📱 New WebSocket connection: ${sessionId}`))
      
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message.toString())
          await this.handleMessage(ws, sessionId, data)
        } catch (error) {
          this.sendError(ws, `Failed to parse message: ${error}`)
        }
      })
      
      ws.on('close', () => {
        console.log(chalk.gray(`📴 WebSocket disconnected: ${sessionId}`))
        this.cleanupSession(sessionId)
      })
      
      ws.on('error', (error) => {
        console.error(chalk.red(`❌ WebSocket error for ${sessionId}:`), error)
        this.cleanupSession(sessionId)
      })
      
      // Send welcome message
      this.sendMessage(ws, {
        type: 'connected',
        sessionId,
        cluster: this.options.cluster,
        task: this.options.taskArn.split('/').pop()
      })
    })
  }
  
  private async handleMessage(ws: WebSocket, sessionId: string, data: any) {
    const { type, command, input } = data
    
    switch (type) {
      case 'execute':
        await this.executeCommand(ws, sessionId, command)
        break
        
      case 'input':
        this.sendInput(sessionId, input)
        break
        
      case 'kill':
        this.killSession(sessionId)
        break
        
      default:
        this.sendError(ws, `Unknown message type: ${type}`)
    }
  }
  
  private async executeCommand(ws: WebSocket, sessionId: string, command: string) {
    const { cluster, taskArn, container = 'claude-code', region = 'us-east-1' } = this.options
    
    console.log(chalk.blue(`🚀 Executing command for session ${sessionId}: ${command}`))
    
    // Build AWS CLI command for non-interactive execution
    const args = [
      'ecs',
      'execute-command',
      '--cluster', cluster,
      '--task', taskArn,
      '--container', container,
      '--command', command,
      '--region', region
    ]
    
    // For interactive commands, add the interactive flag
    const isInteractive = command === '/bin/bash' || command === 'sh'
    if (isInteractive) {
      args.push('--interactive')
    }
    
    const awsProcess = spawn('aws', args, {
      env: process.env
    })
    
    this.sessions.set(sessionId, awsProcess)
    
    // Handle stdout
    awsProcess.stdout?.on('data', (data) => {
      this.sendMessage(ws, {
        type: 'stdout',
        data: data.toString()
      })
    })
    
    // Handle stderr
    awsProcess.stderr?.on('data', (data) => {
      this.sendMessage(ws, {
        type: 'stderr',
        data: data.toString()
      })
    })
    
    // Handle process exit
    awsProcess.on('exit', (code) => {
      this.sendMessage(ws, {
        type: 'exit',
        code
      })
      this.sessions.delete(sessionId)
    })
    
    // Handle errors
    awsProcess.on('error', (error) => {
      this.sendError(ws, `Process error: ${error.message}`)
      this.sessions.delete(sessionId)
    })
  }
  
  private sendInput(sessionId: string, input: string) {
    const process = this.sessions.get(sessionId)
    if (process && process.stdin) {
      process.stdin.write(input)
    }
  }
  
  private killSession(sessionId: string) {
    const process = this.sessions.get(sessionId)
    if (process) {
      process.kill()
      this.sessions.delete(sessionId)
    }
  }
  
  private cleanupSession(sessionId: string) {
    this.killSession(sessionId)
  }
  
  private sendMessage(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }
  
  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      error
    })
  }
  
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  public close() {
    // Kill all active sessions
    for (const [sessionId, process] of this.sessions) {
      process.kill()
    }
    this.sessions.clear()
    
    // Close WebSocket server
    this.wss.close()
  }
}

/**
 * WebSocket client for connecting to ECS Exec WebSocket server
 */
export class ECSExecWebSocketClient {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  
  constructor(private url: string) {}
  
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)
      
      this.ws.on('open', () => {
        console.log(chalk.green('✅ Connected to ECS Exec WebSocket'))
        this.reconnectAttempts = 0
        resolve()
      })
      
      this.ws.on('error', (error) => {
        console.error(chalk.red('❌ WebSocket error:'), error)
        reject(error)
      })
      
      this.ws.on('close', () => {
        console.log(chalk.yellow('⚠️  WebSocket connection closed'))
        this.attemptReconnect()
      })
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        this.handleMessage(message)
      })
    })
  }
  
  private handleMessage(message: any) {
    switch (message.type) {
      case 'connected':
        console.log(chalk.green(`📱 Connected to session: ${message.sessionId}`))
        break
      case 'stdout':
        process.stdout.write(message.data)
        break
      case 'stderr':
        process.stderr.write(message.data)
        break
      case 'exit':
        console.log(chalk.gray(`\nProcess exited with code: ${message.code}`))
        break
      case 'error':
        console.error(chalk.red(`Error: ${message.error}`))
        break
    }
  }
  
  public execute(command: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error(chalk.red('❌ WebSocket is not connected'))
      return
    }
    
    this.ws.send(JSON.stringify({
      type: 'execute',
      command
    }))
  }
  
  public sendInput(input: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }
    
    this.ws.send(JSON.stringify({
      type: 'input',
      input
    }))
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(chalk.red('❌ Max reconnection attempts reached'))
      return
    }
    
    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    
    console.log(chalk.yellow(`🔄 Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`))
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(console.error)
    }, delay)
  }
  
  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}