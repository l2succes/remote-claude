import { WebSocket } from 'ws'
import { TerminalManager } from '../terminal/manager'
import { FileSystemAPI } from '../filesystem/api'
import { ClaudeCodeManager } from '../claude/manager'
import { logger } from '../utils/logger'

interface MessageHandlerConfig {
  terminalManager: TerminalManager
  fileSystemAPI: FileSystemAPI
  claudeManager: ClaudeCodeManager
}

export class MessageHandler {
  private terminalManager: TerminalManager
  private fileSystemAPI: FileSystemAPI
  private claudeManager: ClaudeCodeManager

  constructor(config: MessageHandlerConfig) {
    this.terminalManager = config.terminalManager
    this.fileSystemAPI = config.fileSystemAPI
    this.claudeManager = config.claudeManager
    
    this.setupEventListeners()
  }

  async handle(clientId: string, message: any, ws: WebSocket): Promise<void> {
    const { type, payload } = message
    
    logger.debug('Handling message', { clientId, type })
    
    try {
      switch (type) {
        // Terminal messages
        case 'terminal:create':
          await this.handleTerminalCreate(clientId, payload, ws)
          break
        case 'terminal:write':
          await this.handleTerminalWrite(clientId, payload, ws)
          break
        case 'terminal:resize':
          await this.handleTerminalResize(clientId, payload, ws)
          break
        case 'terminal:close':
          await this.handleTerminalClose(clientId, payload, ws)
          break
          
        // File system messages
        case 'fs:list':
          await this.handleFileList(clientId, payload, ws)
          break
        case 'fs:read':
          await this.handleFileRead(clientId, payload, ws)
          break
        case 'fs:write':
          await this.handleFileWrite(clientId, payload, ws)
          break
        case 'fs:delete':
          await this.handleFileDelete(clientId, payload, ws)
          break
        case 'fs:mkdir':
          await this.handleMkdir(clientId, payload, ws)
          break
        case 'fs:watch':
          await this.handleFileWatch(clientId, payload, ws)
          break
        case 'fs:unwatch':
          await this.handleFileUnwatch(clientId, payload, ws)
          break
          
        // Claude messages
        case 'claude:create':
          await this.handleClaudeCreate(clientId, payload, ws)
          break
        case 'claude:message':
          await this.handleClaudeMessage(clientId, payload, ws)
          break
        case 'claude:close':
          await this.handleClaudeClose(clientId, payload, ws)
          break
          
        default:
          throw new Error(`Unknown message type: ${type}`)
      }
    } catch (error) {
      logger.error('Failed to handle message', { error, clientId, type })
      ws.send(JSON.stringify({
        type: 'error',
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestType: type
        }
      }))
    }
  }

  private setupEventListeners() {
    // Terminal events
    this.terminalManager.on('output', ({ terminalId, clientId, data }) => {
      this.sendToClient(clientId, {
        type: 'terminal:output',
        payload: { terminalId, data }
      })
    })
    
    this.terminalManager.on('exit', ({ terminalId, clientId, exitCode, signal }) => {
      this.sendToClient(clientId, {
        type: 'terminal:exit',
        payload: { terminalId, exitCode, signal }
      })
    })
    
    // File system events
    this.fileSystemAPI.on('file:added', ({ clientId, path, type }) => {
      this.sendToClient(clientId, {
        type: 'fs:changed',
        payload: { path, changeType: 'added', fileType: type }
      })
    })
    
    this.fileSystemAPI.on('file:changed', ({ clientId, path, type }) => {
      this.sendToClient(clientId, {
        type: 'fs:changed',
        payload: { path, changeType: 'modified', fileType: type }
      })
    })
    
    this.fileSystemAPI.on('file:deleted', ({ clientId, path, type }) => {
      this.sendToClient(clientId, {
        type: 'fs:changed',
        payload: { path, changeType: 'deleted', fileType: type }
      })
    })
    
    // Claude events
    this.claudeManager.on('response', ({ sessionId, clientId, message }) => {
      this.sendToClient(clientId, {
        type: 'claude:response',
        payload: { sessionId, message }
      })
    })
  }

  // Terminal handlers
  private async handleTerminalCreate(clientId: string, payload: any, ws: WebSocket) {
    const terminalId = this.terminalManager.createTerminal(clientId)
    ws.send(JSON.stringify({
      type: 'terminal:created',
      payload: { terminalId }
    }))
  }

  private async handleTerminalWrite(clientId: string, payload: any, ws: WebSocket) {
    const { terminalId, data } = payload
    this.terminalManager.writeToTerminal(terminalId, data)
  }

  private async handleTerminalResize(clientId: string, payload: any, ws: WebSocket) {
    const { terminalId, cols, rows } = payload
    this.terminalManager.resizeTerminal(terminalId, cols, rows)
  }

  private async handleTerminalClose(clientId: string, payload: any, ws: WebSocket) {
    const { terminalId } = payload
    this.terminalManager.closeTerminal(terminalId)
  }

  // File system handlers
  private async handleFileList(clientId: string, payload: any, ws: WebSocket) {
    const { path } = payload
    const files = await this.fileSystemAPI.listDirectory(path)
    ws.send(JSON.stringify({
      type: 'fs:list:response',
      payload: { path, files }
    }))
  }

  private async handleFileRead(clientId: string, payload: any, ws: WebSocket) {
    const { path } = payload
    const content = await this.fileSystemAPI.readFile(path)
    ws.send(JSON.stringify({
      type: 'fs:read:response',
      payload: { path, content }
    }))
  }

  private async handleFileWrite(clientId: string, payload: any, ws: WebSocket) {
    const { path, content } = payload
    await this.fileSystemAPI.writeFile(path, content)
    ws.send(JSON.stringify({
      type: 'fs:write:response',
      payload: { path, success: true }
    }))
  }

  private async handleFileDelete(clientId: string, payload: any, ws: WebSocket) {
    const { path, recursive } = payload
    if (path.endsWith('/')) {
      await this.fileSystemAPI.deleteDirectory(path.slice(0, -1), recursive)
    } else {
      await this.fileSystemAPI.deleteFile(path)
    }
    ws.send(JSON.stringify({
      type: 'fs:delete:response',
      payload: { path, success: true }
    }))
  }

  private async handleMkdir(clientId: string, payload: any, ws: WebSocket) {
    const { path } = payload
    await this.fileSystemAPI.createDirectory(path)
    ws.send(JSON.stringify({
      type: 'fs:mkdir:response',
      payload: { path, success: true }
    }))
  }

  private async handleFileWatch(clientId: string, payload: any, ws: WebSocket) {
    const { path } = payload
    this.fileSystemAPI.watchPath(path, clientId)
    ws.send(JSON.stringify({
      type: 'fs:watch:response',
      payload: { path, watching: true }
    }))
  }

  private async handleFileUnwatch(clientId: string, payload: any, ws: WebSocket) {
    const { path } = payload
    this.fileSystemAPI.unwatchPath(path, clientId)
    ws.send(JSON.stringify({
      type: 'fs:unwatch:response',
      payload: { path, watching: false }
    }))
  }

  // Claude handlers
  private async handleClaudeCreate(clientId: string, payload: any, ws: WebSocket) {
    const sessionId = await this.claudeManager.createSession(clientId)
    ws.send(JSON.stringify({
      type: 'claude:created',
      payload: { sessionId }
    }))
  }

  private async handleClaudeMessage(clientId: string, payload: any, ws: WebSocket) {
    const { sessionId, content } = payload
    await this.claudeManager.sendMessage(sessionId, content)
  }

  private async handleClaudeClose(clientId: string, payload: any, ws: WebSocket) {
    const { sessionId } = payload
    this.claudeManager.closeSession(sessionId)
  }

  private sendToClient(clientId: string, message: any) {
    // This would be connected to the WebSocket manager in the main agent
    // For now, we emit an event that the agent can handle
    logger.debug('Sending message to client', { clientId, type: message.type })
  }
}