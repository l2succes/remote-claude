import WebSocket from 'ws'
import express from 'express'
import http from 'http'
import { FileSystemAPI } from './services/file-system'
import { CommandExecutor } from './services/command-executor'
import { StreamManager } from './services/stream-manager'
import { EventEmitter } from 'events'
import chalk from 'chalk'

export interface AgentConfig {
  port: number
  host: string
  workDir: string
  maxConnections?: number
  heartbeatInterval?: number
}

export interface Message {
  id: string
  type: string
  payload?: any
  timestamp: number
}

export class RemoteClaudeAgent extends EventEmitter {
  private app: express.Application
  private server: http.Server | null = null
  private wss: WebSocket.Server | null = null
  private connections: Map<string, WebSocket> = new Map()
  private fileSystem: FileSystemAPI
  private commandExecutor: CommandExecutor
  private streamManager: StreamManager
  private heartbeatTimer: NodeJS.Timeout | null = null
  
  constructor(private config: AgentConfig) {
    super()
    this.app = express()
    this.fileSystem = new FileSystemAPI(config.workDir)
    this.commandExecutor = new CommandExecutor()
    this.streamManager = new StreamManager()
    
    this.setupExpress()
  }
  
  private setupExpress() {
    this.app.use(express.json())
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        connections: this.connections.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        workDir: this.config.workDir
      })
    })
    
    // Agent info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        version: '0.1.0',
        platform: process.platform,
        node: process.version,
        capabilities: [
          'file-system',
          'command-execution',
          'stream-output',
          'watch-files'
        ]
      })
    })
  }
  
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.setupWebSocket()
        this.startHeartbeat()
        resolve()
      })
      
      this.server.on('error', reject)
    })
  }
  
  private setupWebSocket() {
    if (!this.server) return
    
    this.wss = new WebSocket.Server({ server: this.server })
    
    this.wss.on('connection', (ws: WebSocket, req) => {
      const connectionId = this.generateConnectionId()
      const clientIp = req.socket.remoteAddress
      
      console.log(chalk.green(`📱 New connection: ${connectionId} from ${clientIp}`))
      this.connections.set(connectionId, ws)
      
      // Send welcome message
      this.sendMessage(ws, {
        id: this.generateMessageId(),
        type: 'connected',
        payload: {
          connectionId,
          workDir: this.config.workDir,
          capabilities: ['file-system', 'command-execution', 'stream-output']
        },
        timestamp: Date.now()
      })
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString()) as Message
          await this.handleMessage(ws, connectionId, message)
        } catch (error) {
          this.sendError(ws, `Failed to parse message: ${error}`)
        }
      })
      
      ws.on('close', () => {
        console.log(chalk.gray(`📴 Connection closed: ${connectionId}`))
        this.connections.delete(connectionId)
      })
      
      ws.on('error', (error) => {
        console.error(chalk.red(`❌ WebSocket error for ${connectionId}:`), error)
        this.connections.delete(connectionId)
      })
    })
  }
  
  private async handleMessage(ws: WebSocket, connectionId: string, message: Message) {
    console.log(chalk.blue(`📨 Message from ${connectionId}:`), message.type)
    
    try {
      switch (message.type) {
        case 'file:read':
          await this.handleFileRead(ws, message)
          break
        case 'file:write':
          await this.handleFileWrite(ws, message)
          break
        case 'file:delete':
          await this.handleFileDelete(ws, message)
          break
        case 'file:list':
          await this.handleFileList(ws, message)
          break
        case 'file:watch':
          await this.handleFileWatch(ws, message)
          break
        case 'command:execute':
          await this.handleCommandExecute(ws, message)
          break
        case 'command:kill':
          await this.handleCommandKill(ws, message)
          break
        case 'ping':
          this.handlePing(ws, message)
          break
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`)
      }
    } catch (error: any) {
      this.sendError(ws, error.message, message.id)
    }
  }
  
  private async handleFileRead(ws: WebSocket, message: Message) {
    const { path } = message.payload
    const content = await this.fileSystem.readFile(path)
    
    this.sendMessage(ws, {
      id: message.id,
      type: 'file:read:response',
      payload: { path, content },
      timestamp: Date.now()
    })
  }
  
  private async handleFileWrite(ws: WebSocket, message: Message) {
    const { path, content } = message.payload
    await this.fileSystem.writeFile(path, content)
    
    this.sendMessage(ws, {
      id: message.id,
      type: 'file:write:response',
      payload: { path, success: true },
      timestamp: Date.now()
    })
  }
  
  private async handleFileDelete(ws: WebSocket, message: Message) {
    const { path } = message.payload
    await this.fileSystem.deleteFile(path)
    
    this.sendMessage(ws, {
      id: message.id,
      type: 'file:delete:response',
      payload: { path, success: true },
      timestamp: Date.now()
    })
  }
  
  private async handleFileList(ws: WebSocket, message: Message) {
    const { path, recursive } = message.payload
    const files = await this.fileSystem.listDirectory(path, recursive)
    
    this.sendMessage(ws, {
      id: message.id,
      type: 'file:list:response',
      payload: { path, files },
      timestamp: Date.now()
    })
  }
  
  private async handleFileWatch(ws: WebSocket, message: Message) {
    const { path } = message.payload
    
    const watcher = this.fileSystem.watchFile(path, (event, filename) => {
      this.sendMessage(ws, {
        id: this.generateMessageId(),
        type: 'file:changed',
        payload: { path, event, filename },
        timestamp: Date.now()
      })
    })
    
    this.sendMessage(ws, {
      id: message.id,
      type: 'file:watch:response',
      payload: { path, watching: true },
      timestamp: Date.now()
    })
    
    // Store watcher for cleanup
    ws.on('close', () => {
      watcher.close()
    })
  }
  
  private async handleCommandExecute(ws: WebSocket, message: Message) {
    const { command, args, cwd, env } = message.payload
    
    const execution = await this.commandExecutor.execute(command, args, {
      cwd: cwd || this.config.workDir,
      env: { ...process.env, ...env }
    })
    
    // Stream stdout
    execution.stdout.on('data', (data) => {
      this.sendMessage(ws, {
        id: message.id,
        type: 'command:stdout',
        payload: { data: data.toString() },
        timestamp: Date.now()
      })
    })
    
    // Stream stderr
    execution.stderr.on('data', (data) => {
      this.sendMessage(ws, {
        id: message.id,
        type: 'command:stderr',
        payload: { data: data.toString() },
        timestamp: Date.now()
      })
    })
    
    // Handle exit
    execution.on('exit', (code) => {
      this.sendMessage(ws, {
        id: message.id,
        type: 'command:exit',
        payload: { code },
        timestamp: Date.now()
      })
    })
    
    // Send initial response
    this.sendMessage(ws, {
      id: message.id,
      type: 'command:execute:response',
      payload: { pid: execution.pid },
      timestamp: Date.now()
    })
  }
  
  private async handleCommandKill(ws: WebSocket, message: Message) {
    const { pid } = message.payload
    const success = await this.commandExecutor.kill(pid)
    
    this.sendMessage(ws, {
      id: message.id,
      type: 'command:kill:response',
      payload: { pid, success },
      timestamp: Date.now()
    })
  }
  
  private handlePing(ws: WebSocket, message: Message) {
    this.sendMessage(ws, {
      id: message.id,
      type: 'pong',
      payload: { timestamp: Date.now() },
      timestamp: Date.now()
    })
  }
  
  private sendMessage(ws: WebSocket, message: Message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }
  
  private sendError(ws: WebSocket, error: string, requestId?: string) {
    this.sendMessage(ws, {
      id: requestId || this.generateMessageId(),
      type: 'error',
      payload: { error },
      timestamp: Date.now()
    })
  }
  
  private startHeartbeat() {
    const interval = this.config.heartbeatInterval || 30000
    
    this.heartbeatTimer = setInterval(() => {
      for (const [id, ws] of this.connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping()
        } else {
          this.connections.delete(id)
        }
      }
    }, interval)
  }
  
  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    
    // Close all connections
    for (const [id, ws] of this.connections) {
      ws.close()
    }
    this.connections.clear()
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close()
    }
    
    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve())
      })
    }
  }
  
  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}