import { WebSocketServer, WebSocket } from 'ws'
import { createServer, Server } from 'http'
import express, { Express } from 'express'
import { TerminalManager } from './terminal/manager'
import { FileSystemAPI } from './filesystem/api'
import { ClaudeCodeManager } from './claude/manager'
import { logger } from './utils/logger'
import { MessageHandler } from './websocket/message-handler'
import { AuthManager } from './auth/manager'

export class RemoteClaudeAgent {
  private app: Express
  private server: Server
  private wss: WebSocketServer
  private terminalManager: TerminalManager
  private fileSystemAPI: FileSystemAPI
  private claudeManager: ClaudeCodeManager
  private messageHandler: MessageHandler
  private authManager: AuthManager
  private clients: Map<string, WebSocket> = new Map()

  constructor() {
    this.app = express()
    this.server = createServer(this.app)
    this.wss = new WebSocketServer({ server: this.server })
    
    // Initialize managers
    this.terminalManager = new TerminalManager()
    this.fileSystemAPI = new FileSystemAPI()
    this.claudeManager = new ClaudeCodeManager()
    this.authManager = new AuthManager()
    this.messageHandler = new MessageHandler({
      terminalManager: this.terminalManager,
      fileSystemAPI: this.fileSystemAPI,
      claudeManager: this.claudeManager
    })
    
    this.setupExpressRoutes()
    this.setupWebSocketHandlers()
  }

  private setupExpressRoutes() {
    this.app.use(express.json())
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        version: '0.1.0',
        terminals: this.terminalManager.getActiveCount(),
        clients: this.clients.size
      })
    })
    
    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      })
    })
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', async (ws: WebSocket, req) => {
      const clientId = this.generateClientId()
      logger.info('New WebSocket connection', { clientId })
      
      // Authenticate the connection
      const token = this.extractToken(req.url || '')
      const isValid = await this.authManager.validateToken(token)
      
      if (!isValid) {
        logger.warn('Invalid authentication token', { clientId })
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Authentication failed' }
        }))
        ws.close(1008, 'Authentication failed')
        return
      }
      
      this.clients.set(clientId, ws)
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        payload: {
          clientId,
          version: '0.1.0',
          capabilities: [
            'terminal',
            'filesystem',
            'claude-code'
          ]
        }
      }))
      
      // Handle messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString())
          await this.messageHandler.handle(clientId, message, ws)
        } catch (error) {
          logger.error('Failed to handle message', { error, clientId })
          ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Invalid message format' }
          }))
        }
      })
      
      // Handle disconnect
      ws.on('close', () => {
        logger.info('Client disconnected', { clientId })
        this.clients.delete(clientId)
        this.terminalManager.cleanupClient(clientId)
      })
      
      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error', { error, clientId })
      })
    })
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        logger.info(`Agent listening on port ${port}`)
        resolve()
      })
      
      this.server.on('error', (error) => {
        logger.error('Server error', { error })
        reject(error)
      })
    })
  }

  async stop(): Promise<void> {
    logger.info('Stopping agent')
    
    // Close all WebSocket connections
    for (const [clientId, ws] of this.clients) {
      ws.close(1001, 'Server shutting down')
    }
    
    // Clean up resources
    await this.terminalManager.cleanup()
    await this.claudeManager.cleanup()
    
    // Close servers
    this.wss.close()
    
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Agent stopped')
        resolve()
      })
    })
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private extractToken(url: string): string {
    const match = url.match(/token=([^&]+)/)
    return match ? match[1] : ''
  }
}