/**
 * Core types and interfaces for compute provider abstraction
 */

export interface Environment {
  id: string
  provider: string
  status: EnvironmentStatus
  createdAt: Date
  metadata: Record<string, any>
}

export interface EnvironmentOptions {
  name?: string
  machineType?: string
  timeout?: number
  autoCleanup?: boolean
  metadata?: Record<string, any>
}

export interface TaskDefinition {
  id: string
  command: string
  workingDirectory?: string
  environment?: Record<string, string>
  files?: FileMap
  timeout?: number
}

export interface TaskExecution {
  id: string
  environmentId: string
  status: TaskStatus
  startTime: Date
  endTime?: Date
  exitCode?: number
  output?: string
  error?: string
}

export interface FileMap {
  [remotePath: string]: string | Buffer
}

export type LogCallback = (chunk: string) => void

export enum EnvironmentStatus {
  CREATING = 'creating',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Core interface that all compute providers must implement
 */
export interface ComputeProvider {
  readonly name: string
  readonly type: ComputeProviderType
  
  // Environment lifecycle
  createEnvironment(options: EnvironmentOptions): Promise<Environment>
  destroyEnvironment(envId: string): Promise<void>
  getEnvironmentStatus(envId: string): Promise<EnvironmentStatus>
  listEnvironments(): Promise<Environment[]>
  
  // Task execution
  executeTask(env: Environment, task: TaskDefinition): Promise<TaskExecution>
  getTaskStatus(envId: string, taskId: string): Promise<TaskStatus>
  cancelTask(envId: string, taskId: string): Promise<void>
  streamLogs(envId: string, callback: LogCallback): Promise<void>
  
  // File operations
  uploadFiles(envId: string, files: FileMap): Promise<void>
  downloadResults(envId: string, paths: string[]): Promise<FileMap>
  
  // Validation and configuration
  validateConfig(config: any): Promise<ValidationResult>
  getCapabilities(): ProviderCapabilities
}

export enum ComputeProviderType {
  CODESPACE = 'codespace',
  AWS = 'aws',
  FLY = 'fly'
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ProviderCapabilities {
  supportsSpotInstances?: boolean
  supportsPersistentStorage?: boolean
  supportsCustomImages?: boolean
  supportsDockerContainers?: boolean
  maxConcurrentTasks?: number
  maxTaskDuration?: number
}

/**
 * Configuration interfaces for different providers
 */
export interface ComputeConfig {
  provider: ComputeProviderType
  codespace?: CodespaceConfig
  ec2?: EC2Config
  aws?: {
    mode: string
    region: string
  }
  [key: string]: any  // For provider-specific configs
}

export interface CodespaceConfig {
  defaultMachine?: string
  defaultIdleTimeout?: number
  repository?: string | undefined
  branch?: string
}

export interface EC2Config {
  region: string
  instanceType: string
  ami?: string
  subnetId?: string
  securityGroupIds?: string[]
  keyPair?: string
  spotInstance?: boolean
  idleTimeout?: number
  autoTerminate?: boolean
  tags?: Record<string, string>
  userData?: string
}

/**
 * Events emitted by compute providers
 */
export interface ComputeEvent {
  type: ComputeEventType
  environmentId: string
  taskId?: string
  timestamp: Date
  data?: any
}

export enum ComputeEventType {
  ENVIRONMENT_CREATED = 'environment.created',
  ENVIRONMENT_STARTED = 'environment.started',
  ENVIRONMENT_STOPPED = 'environment.stopped',
  ENVIRONMENT_ERROR = 'environment.error',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_CANCELLED = 'task.cancelled'
}