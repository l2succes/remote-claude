import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface ClientConfig {
  url: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  timeout?: number
}

export interface ClientMessage {
  id?: string
  type: string
  payload?: any
}

export class RemoteClaudeClient extends EventEmitter {
  private ws: WebSocket | null = null
  private messageQueue: ClientMessage[] = []
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map()
  
  constructor(private config: ClientConfig) {
    super()
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url)
      
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
        this.ws?.close()
      }, this.config.timeout || 10000)
      
      this.ws.on('open', () => {
        clearTimeout(timeout)
        this.reconnectAttempts = 0
        this.emit('connected')
        
        // Send queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift()
          if (message) {
            this.send(message)
          }
        }
        
        resolve()
      })
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(message)
        } catch (error) {
          this.emit('error', error)
        }
      })
      
      this.ws.on('close', () => {
        this.emit('disconnected')
        this.ws = null
        
        if (this.config.reconnect) {
          this.attemptReconnect()
        }
      })
      
      this.ws.on('error', (error) => {
        clearTimeout(timeout)
        this.emit('error', error)
        reject(error)
      })
    })
  }
  
  private handleMessage(message: any) {
    // Check if this is a response to a pending request
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!
      this.pendingRequests.delete(message.id)
      
      if (message.type === 'error') {
        reject(new Error(message.payload?.error || 'Unknown error'))
      } else {
        resolve(message)
      }
    }
    
    // Emit message for general handling
    this.emit('message', message)
    this.emit(message.type, message.payload)
  }
  
  private attemptReconnect() {
    const maxAttempts = this.config.maxReconnectAttempts || 5
    
    if (this.reconnectAttempts >= maxAttempts) {
      this.emit('reconnect-failed')
      return
    }
    
    this.reconnectAttempts++
    const interval = this.config.reconnectInterval || 5000
    
    this.emit('reconnecting', this.reconnectAttempts)
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Continue trying
      })
    }, interval)
  }
  
  send(message: ClientMessage): void {
    if (!message.id) {
      message.id = this.generateId()
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }))
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message)
    }
  }
  
  async request(type: string, payload?: any, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.generateId()
      
      // Set timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error('Request timeout'))
      }, timeout)
      
      // Store pending request
      this.pendingRequests.set(id, {
        resolve: (response: any) => {
          clearTimeout(timer)
          resolve(response)
        },
        reject: (error: Error) => {
          clearTimeout(timer)
          reject(error)
        }
      })
      
      // Send request
      this.send({ id, type, payload })
    })
  }
  
  // File system operations
  async readFile(path: string): Promise<string> {
    const response = await this.request('file:read', { path })
    return response.payload.content
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    await this.request('file:write', { path, content })
  }
  
  async deleteFile(path: string): Promise<void> {
    await this.request('file:delete', { path })
  }
  
  async listFiles(path: string, recursive = false): Promise<any[]> {
    const response = await this.request('file:list', { path, recursive })
    return response.payload.files
  }
  
  // Command execution
  async executeCommand(command: string, args: string[] = [], options: any = {}): Promise<number> {
    const response = await this.request('command:execute', {
      command,
      args,
      ...options
    })
    
    return new Promise((resolve) => {
      this.on('command:exit', (payload) => {
        if (payload.pid === response.payload.pid) {
          resolve(payload.code)
        }
      })
    })
  }
  
  async killProcess(pid: number): Promise<boolean> {
    const response = await this.request('command:kill', { pid })
    return response.payload.success
  }
  
  // Watch for file changes
  watchFile(path: string, callback: (event: any) => void): () => void {
    this.request('file:watch', { path }).catch(console.error)
    
    const handler = (payload: any) => {
      if (payload.path === path) {
        callback(payload)
      }
    }
    
    this.on('file:changed', handler)
    
    // Return unwatch function
    return () => {
      this.off('file:changed', handler)
    }
  }
  
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    // Reject all pending requests
    for (const { reject } of this.pendingRequests.values()) {
      reject(new Error('Client disconnected'))
    }
    this.pendingRequests.clear()
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}