/**
 * Compute provider types and interfaces
 */

export interface ComputeSession {
  id: string
  provider: string
  status: 'active' | 'terminated' | 'error'
  createdAt?: Date
  metadata?: Record<string, any>
}

export interface SessionOptions {
  taskId: string
  userId: string
  repository?: string
  branch?: string
  resources?: {
    cpu?: string
    memory?: string
    disk?: string
    gpu?: string
  }
}

export interface TaskResult {
  success: boolean
  output?: string
  error?: string
  exitCode?: number
}

export interface ComputeProvider {
  readonly name: string
  
  initialize(): Promise<void>
  shutdown(): Promise<void>
  
  createSession(options: SessionOptions): Promise<ComputeSession>
  terminateSession(sessionId: string): Promise<void>
  
  executeCommand(sessionId: string, command: string): Promise<TaskResult>
  
  getSessionStatus(sessionId: string): Promise<ComputeSession>
  listSessions(userId?: string): Promise<ComputeSession[]>
}