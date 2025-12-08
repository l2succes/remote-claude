/**
 * ComputeManager - Central manager for all compute providers
 */

import { EventEmitter } from 'events'
import {
  ComputeProvider,
  ComputeProviderType,
  ComputeConfig,
  Environment,
  EnvironmentOptions,
  TaskDefinition,
  TaskExecution,
  FileMap,
  LogCallback,
  ValidationResult,
  ComputeEvent,
  ComputeEventType
} from './types'

export class ComputeManager extends EventEmitter {
  private providers: Map<ComputeProviderType, ComputeProvider> = new Map()
  private activeEnvironments: Map<string, Environment> = new Map()
  private config: ComputeConfig

  constructor(config: ComputeConfig) {
    super()
    this.config = config
  }

  /**
   * Register a compute provider
   */
  registerProvider(provider: ComputeProvider): void {
    this.providers.set(provider.type, provider)
    
    // Forward provider events
    if (provider instanceof EventEmitter) {
      provider.on('*', (event: ComputeEvent) => {
        this.emit('compute-event', event)
      })
    }
  }

  /**
   * Get the active provider based on configuration
   */
  getActiveProvider(): ComputeProvider {
    const provider = this.providers.get(this.config.provider)
    if (!provider) {
      throw new Error(`Provider '${this.config.provider}' not registered`)
    }
    return provider
  }

  /**
   * Get a specific provider by type
   */
  getProvider(type: ComputeProviderType): ComputeProvider | undefined {
    return this.providers.get(type)
  }

  /**
   * List all registered providers
   */
  getAvailableProviders(): ComputeProviderType[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Validate configuration for the active provider
   */
  async validateConfig(): Promise<ValidationResult> {
    const provider = this.getActiveProvider()
    const providerConfig = this.getProviderConfig(provider.type)
    return provider.validateConfig(providerConfig)
  }

  /**
   * Create a new environment using the active provider
   */
  async createEnvironment(options: EnvironmentOptions = {}): Promise<Environment> {
    const provider = this.getActiveProvider()
    const environment = await provider.createEnvironment(options)
    
    this.activeEnvironments.set(environment.id, environment)
    
    this.emitEvent(ComputeEventType.ENVIRONMENT_CREATED, environment.id)
    
    return environment
  }

  /**
   * Execute a task in the specified environment
   */
  async executeTask(environmentId: string, task: TaskDefinition): Promise<TaskExecution> {
    const environment = await this.getEnvironment(environmentId)
    const provider = this.getProvider(environment.provider as ComputeProviderType)
    
    if (!provider) {
      throw new Error(`Provider '${environment.provider}' not available`)
    }

    this.emitEvent(ComputeEventType.TASK_STARTED, environmentId, task.id)
    
    try {
      const execution = await provider.executeTask(environment, task)
      
      if (execution.status === 'completed') {
        this.emitEvent(ComputeEventType.TASK_COMPLETED, environmentId, task.id)
      } else if (execution.status === 'failed') {
        this.emitEvent(ComputeEventType.TASK_FAILED, environmentId, task.id)
      }
      
      return execution
    } catch (error) {
      this.emitEvent(ComputeEventType.TASK_FAILED, environmentId, task.id)
      throw error
    }
  }

  /**
   * Get environment details
   */
  async getEnvironment(environmentId: string): Promise<Environment> {
    const cachedEnv = this.activeEnvironments.get(environmentId)
    if (cachedEnv) {
      // Refresh status
      const provider = this.getProvider(cachedEnv.provider as ComputeProviderType)
      if (provider) {
        const status = await provider.getEnvironmentStatus(environmentId)
        cachedEnv.status = status
        return cachedEnv
      }
    }
    
    // Try to find environment across all providers
    for (const [, provider] of this.providers) {
      try {
        const environments = await provider.listEnvironments()
        const env = environments.find(e => e.id === environmentId)
        if (env) {
          this.activeEnvironments.set(environmentId, env)
          return env
        }
      } catch (error) {
        // Continue searching other providers
      }
    }
    
    throw new Error(`Environment '${environmentId}' not found`)
  }

  /**
   * List all environments across all providers
   */
  async listEnvironments(): Promise<Environment[]> {
    const allEnvironments: Environment[] = []
    
    for (const [, provider] of this.providers) {
      try {
        const environments = await provider.listEnvironments()
        allEnvironments.push(...environments)
      } catch (error) {
        // Log error but continue with other providers
        console.warn(`Failed to list environments for provider ${provider.name}:`, error)
      }
    }
    
    // Update cache
    for (const env of allEnvironments) {
      this.activeEnvironments.set(env.id, env)
    }
    
    return allEnvironments
  }

  /**
   * Destroy an environment
   */
  async destroyEnvironment(environmentId: string): Promise<void> {
    const environment = await this.getEnvironment(environmentId)
    const provider = this.getProvider(environment.provider as ComputeProviderType)
    
    if (!provider) {
      throw new Error(`Provider '${environment.provider}' not available`)
    }
    
    await provider.destroyEnvironment(environmentId)
    this.activeEnvironments.delete(environmentId)
    
    this.emitEvent(ComputeEventType.ENVIRONMENT_STOPPED, environmentId)
  }

  /**
   * Stream logs from an environment
   */
  async streamLogs(environmentId: string, callback: LogCallback): Promise<void> {
    const environment = await this.getEnvironment(environmentId)
    const provider = this.getProvider(environment.provider as ComputeProviderType)
    
    if (!provider) {
      throw new Error(`Provider '${environment.provider}' not available`)
    }
    
    return provider.streamLogs(environmentId, callback)
  }

  /**
   * Upload files to an environment
   */
  async uploadFiles(environmentId: string, files: FileMap): Promise<void> {
    const environment = await this.getEnvironment(environmentId)
    const provider = this.getProvider(environment.provider as ComputeProviderType)
    
    if (!provider) {
      throw new Error(`Provider '${environment.provider}' not available`)
    }
    
    return provider.uploadFiles(environmentId, files)
  }

  /**
   * Download files from an environment
   */
  async downloadResults(environmentId: string, paths: string[]): Promise<FileMap> {
    const environment = await this.getEnvironment(environmentId)
    const provider = this.getProvider(environment.provider as ComputeProviderType)
    
    if (!provider) {
      throw new Error(`Provider '${environment.provider}' not available`)
    }
    
    return provider.downloadResults(environmentId, paths)
  }

  /**
   * Cancel a running task
   */
  async cancelTask(environmentId: string, taskId: string): Promise<void> {
    const environment = await this.getEnvironment(environmentId)
    const provider = this.getProvider(environment.provider as ComputeProviderType)
    
    if (!provider) {
      throw new Error(`Provider '${environment.provider}' not available`)
    }
    
    await provider.cancelTask(environmentId, taskId)
    this.emitEvent(ComputeEventType.TASK_CANCELLED, environmentId, taskId)
  }

  /**
   * Get provider-specific configuration
   */
  private getProviderConfig(type: ComputeProviderType): any {
    switch (type) {
      case ComputeProviderType.CODESPACE:
        return this.config.codespace
      case ComputeProviderType.AWS:
        return this.config.aws
      default:
        return {}
    }
  }

  /**
   * Emit a compute event
   */
  private emitEvent(type: ComputeEventType, environmentId: string, taskId?: string): void {
    const event: ComputeEvent = {
      type,
      environmentId,
      ...(taskId && { taskId }),
      timestamp: new Date()
    }
    
    this.emit('compute-event', event)
  }

  /**
   * Cleanup all environments and resources
   */
  async cleanup(): Promise<void> {
    const environments = Array.from(this.activeEnvironments.values())
    
    await Promise.allSettled(
      environments.map(env => this.destroyEnvironment(env.id))
    )
    
    this.activeEnvironments.clear()
  }
}