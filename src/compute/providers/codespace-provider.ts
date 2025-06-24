/**
 * CodespaceProvider - Wraps existing CodespaceManager to implement ComputeProvider interface
 */

import { EventEmitter } from 'events'
import {
  ComputeProvider,
  ComputeProviderType,
  Environment,
  EnvironmentOptions,
  EnvironmentStatus,
  TaskDefinition,
  TaskExecution,
  TaskStatus,
  FileMap,
  LogCallback,
  ValidationResult,
  ProviderCapabilities,
  CodespaceConfig
} from '../types'
import { GitHubAPI, Codespace, CodespaceOptions } from '../../codespace/github-api'

export interface CodespaceTaskOptions {
  task: string
  repository: string
  branch?: string
  timeout?: number
  autoCommit?: boolean
  pullRequest?: boolean
  outputFiles?: string[]
}

export class CodespaceProvider extends EventEmitter implements ComputeProvider {
  readonly name = 'GitHub Codespaces'
  readonly type = ComputeProviderType.CODESPACE

  private api: GitHubAPI
  private config: CodespaceConfig
  private activeEnvironments: Map<string, Environment> = new Map()

  constructor(token: string, config: CodespaceConfig = {}) {
    super()
    this.api = new GitHubAPI(token)
    this.config = config
  }

  /**
   * Create a new codespace environment
   */
  async createEnvironment(options: EnvironmentOptions = {}): Promise<Environment> {
    if (!this.config.repository && !options.metadata?.repository) {
      throw new Error('Repository is required for codespace creation')
    }

    const repository = options.metadata?.repository || this.config.repository!
    const displayName = options.name || `remote-claude-${Date.now()}`

    const codespaceOptions: CodespaceOptions = {
      repository,
      branch: options.metadata?.branch || this.config.branch,
      machine: options.machineType || this.config.defaultMachine || 'basicLinux32gb',
      displayName,
      idleTimeoutMinutes: this.config.defaultIdleTimeout || 30,
      retentionPeriodMinutes: 60 * 24 // 24 hours
    }

    const codespace = await this.api.createCodespace(codespaceOptions)
    
    const environment: Environment = {
      id: codespace.name,
      provider: this.type,
      status: this.mapCodespaceState(codespace.state),
      createdAt: new Date(codespace.created_at),
      metadata: {
        codespace,
        repository,
        displayName
      }
    }

    this.activeEnvironments.set(environment.id, environment)

    // Wait for codespace to be ready
    await this.waitForCodespaceReady(codespace.name)
    environment.status = EnvironmentStatus.RUNNING

    this.emit('environment-created', environment)
    return environment
  }

  /**
   * Destroy a codespace environment
   */
  async destroyEnvironment(envId: string): Promise<void> {
    await this.api.deleteCodespace(envId)
    this.activeEnvironments.delete(envId)
    this.emit('environment-destroyed', envId)
  }

  /**
   * Get environment status
   */
  async getEnvironmentStatus(envId: string): Promise<EnvironmentStatus> {
    const codespace = await this.api.getCodespace(envId)
    return this.mapCodespaceState(codespace.state)
  }

  /**
   * List all environments (codespaces)
   */
  async listEnvironments(): Promise<Environment[]> {
    const codespaces = await this.api.listCodespaces()
    
    // Filter to Remote Claude codespaces
    const remoteClaudeCodespaces = codespaces.filter(cs => 
      cs.name?.includes('remote-claude') || cs.name?.startsWith('rcli-')
    )

    const environments = remoteClaudeCodespaces.map(codespace => ({
      id: codespace.name,
      provider: this.type,
      status: this.mapCodespaceState(codespace.state),
      createdAt: new Date(codespace.created_at),
      metadata: { codespace }
    }))

    // Update cache
    for (const env of environments) {
      this.activeEnvironments.set(env.id, env)
    }

    return environments
  }

  /**
   * Execute a task in a codespace
   */
  async executeTask(env: Environment, task: TaskDefinition): Promise<TaskExecution> {
    const execution: TaskExecution = {
      id: task.id,
      environmentId: env.id,
      status: TaskStatus.RUNNING,
      startTime: new Date()
    }

    try {
      // Install Claude Code if not already installed
      await this.installClaudeCode(env.id)

      // Upload files if provided
      if (task.files) {
        await this.uploadFiles(env.id, task.files)
      }

      // Build and execute the command
      const command = this.buildClaudeCommand(task)
      const result = await this.api.executeCommand(env.id, command)

      execution.status = TaskStatus.COMPLETED
      execution.endTime = new Date()
      execution.exitCode = 0
      execution.output = result

      this.emit('task-completed', execution)
      return execution

    } catch (error) {
      execution.status = TaskStatus.FAILED
      execution.endTime = new Date()
      execution.exitCode = 1
      execution.error = (error as Error).message

      this.emit('task-failed', execution)
      return execution
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(envId: string, taskId: string): Promise<TaskStatus> {
    // For codespaces, we don't track individual task status
    // This would need to be enhanced with a task tracking system
    return TaskStatus.COMPLETED
  }

  /**
   * Cancel a running task
   */
  async cancelTask(envId: string, taskId: string): Promise<void> {
    // This would require implementing task cancellation in the codespace
    // For now, we'll stop the entire codespace
    await this.api.stopCodespace(envId)
    this.emit('task-cancelled', { envId, taskId })
  }

  /**
   * Stream logs from codespace
   */
  async streamLogs(envId: string, callback: LogCallback): Promise<void> {
    // GitHub Codespaces doesn't provide a direct log streaming API
    // This would need to be implemented via the webhook system or polling
    // For now, we'll emit a placeholder
    callback('Log streaming not yet implemented for Codespaces\n')
  }

  /**
   * Upload files to codespace
   */
  async uploadFiles(envId: string, files: FileMap): Promise<void> {
    for (const [remotePath, content] of Object.entries(files)) {
      const fileContent = typeof content === 'string' ? content : content.toString('base64')
      const command = `cat > "${remotePath}" << 'FILE_EOF'\n${fileContent}\nFILE_EOF`
      await this.api.executeCommand(envId, command)
    }
  }

  /**
   * Download files from codespace
   */
  async downloadResults(envId: string, paths: string[]): Promise<FileMap> {
    const files: FileMap = {}

    for (const path of paths) {
      try {
        const content = await this.api.executeCommand(envId, `cat "${path}"`)
        files[path] = content
      } catch (error) {
        // File might not exist, continue with others
        console.warn(`Failed to download ${path}:`, (error as Error).message)
      }
    }

    return files
  }

  /**
   * Validate codespace configuration
   */
  async validateConfig(config: CodespaceConfig): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!config.repository) {
      errors.push('Repository is required for Codespace provider')
    }

    if (config.defaultIdleTimeout && config.defaultIdleTimeout < 5) {
      warnings.push('Idle timeout less than 5 minutes may cause frequent shutdowns')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsSpotInstances: false,
      supportsPersistentStorage: true,
      supportsCustomImages: false,
      supportsDockerContainers: true,
      maxConcurrentTasks: 1, // One task per codespace
      maxTaskDuration: 8 * 60 * 60 * 1000 // 8 hours in ms
    }
  }

  /**
   * Wait for codespace to be ready
   */
  private async waitForCodespaceReady(name: string, maxAttempts = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const codespace = await this.api.getCodespace(name)
      
      if (codespace.state === 'Available') {
        return
      }
      
      if (codespace.state === 'Failed') {
        throw new Error('Codespace creation failed')
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
    
    throw new Error(`Codespace not ready after ${maxAttempts * 5} seconds`)
  }

  /**
   * Install Claude Code in the codespace
   */
  private async installClaudeCode(codespaceName: string): Promise<void> {
    try {
      // Check if already installed
      await this.api.executeCommand(codespaceName, 'claude -v')
      return // Already installed
    } catch {
      // Not installed, proceed with installation
    }

    const installCommand = 'npm install -g @anthropic-ai/claude-code'
    await this.api.executeCommand(codespaceName, installCommand)
    
    // Verify installation
    await this.api.executeCommand(codespaceName, 'claude -v')
  }

  /**
   * Build Claude Code command from task definition
   */
  private buildClaudeCommand(task: TaskDefinition): string {
    const args = ['claude']
    
    // Add the main command/task
    args.push(`"${task.command}"`)
    
    // Change to working directory if specified
    if (task.workingDirectory) {
      return `cd "${task.workingDirectory}" && ${args.join(' ')}`
    }
    
    return args.join(' ')
  }

  /**
   * Map codespace state to environment status
   */
  private mapCodespaceState(state: string): EnvironmentStatus {
    switch (state) {
      case 'Created':
      case 'Queued':
      case 'Provisioning':
        return EnvironmentStatus.CREATING
      case 'Starting':
        return EnvironmentStatus.STARTING
      case 'Available':
        return EnvironmentStatus.RUNNING
      case 'Shutdown':
      case 'ShuttingDown':
        return EnvironmentStatus.STOPPING
      case 'Stopped':
      case 'Archived':
        return EnvironmentStatus.STOPPED
      case 'Failed':
        return EnvironmentStatus.ERROR
      default:
        return EnvironmentStatus.ERROR
    }
  }
}