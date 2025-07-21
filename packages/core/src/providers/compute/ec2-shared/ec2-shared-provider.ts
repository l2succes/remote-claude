import { ComputeProvider, TaskExecutionResult, ComputeSession } from '@remote-claude/core/types/compute'
import { EC2InstancePool, PoolConfig } from './instance-pool'
import { ContainerOrchestrator, ContainerConfig } from './container-orchestrator'
import { Logger } from '@remote-claude/core/utils/logger'
import { getConfig } from '@remote-claude/core/utils/config'
import { EventEmitter } from 'events'

export interface SharedEC2Config extends PoolConfig {
  enabled: boolean
  defaultResources: {
    cpu: string
    memory: string
    disk: string
  }
}

export class EC2SharedProvider implements ComputeProvider {
  readonly name = 'ec2-shared'
  private logger = new Logger('EC2SharedProvider')
  private instancePool: EC2InstancePool
  private containerOrchestrator: ContainerOrchestrator
  private eventEmitter: EventEmitter
  private config: SharedEC2Config

  constructor(config?: Partial<SharedEC2Config>) {
    this.config = {
      enabled: config?.enabled ?? true,
      minInstances: config?.minInstances ?? 1,
      maxInstances: config?.maxInstances ?? 10,
      maxTasksPerInstance: config?.maxTasksPerInstance ?? 5,
      instanceType: config?.instanceType ?? 't3.large',
      idleTimeout: config?.idleTimeout ?? 900, // 15 minutes
      scaleUpThreshold: config?.scaleUpThreshold ?? 0.8,
      scaleDownThreshold: config?.scaleDownThreshold ?? 0.3,
      defaultResources: config?.defaultResources ?? {
        cpu: '1',
        memory: '2g',
        disk: '10g',
      },
    }

    this.instancePool = new EC2InstancePool(this.config)
    this.containerOrchestrator = new ContainerOrchestrator()
    this.eventEmitter = new EventEmitter()
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('EC2 Shared provider is disabled')
      return
    }

    this.logger.info('Initializing EC2 Shared provider')
    await this.instancePool.initialize()
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down EC2 Shared provider')
    await this.instancePool.shutdown()
  }

  async createSession(options: {
    taskId: string
    userId: string
    repository?: string
    branch?: string
    resources?: {
      cpu?: string
      memory?: string
      disk?: string
    }
  }): Promise<ComputeSession> {
    this.logger.info('Creating shared EC2 session', { options })

    if (!options.repository) {
      throw new Error('Repository is required for shared EC2 sessions')
    }

    // Get available instance
    const instance = await this.instancePool.getAvailableInstance()
    if (!instance) {
      throw new Error('No available instances in pool')
    }

    // Assign task to instance
    await this.instancePool.assignTask(instance.instanceId, options.taskId)

    try {
      // Get or create container for the repository
      const containerConfig: ContainerConfig = {
        repository: options.repository,
        branch: options.branch,
        cpuLimit: options.resources?.cpu || this.config.defaultResources.cpu,
        memoryLimit: options.resources?.memory || this.config.defaultResources.memory,
        diskLimit: options.resources?.disk || this.config.defaultResources.disk,
        environment: {
          REMOTE_CLAUDE: 'true',
          PROVIDER: 'ec2-shared',
        },
      }

      const containerInfo = await this.containerOrchestrator.getOrCreateContainer(
        instance.publicIp,
        containerConfig
      )

      // Add this task to the container
      await this.containerOrchestrator.addTaskToContainer(options.repository, options.taskId)

      const session: ComputeSession = {
        id: options.taskId,
        provider: this.name,
        status: 'active',
        startTime: new Date(),
        metadata: {
          instanceId: instance.instanceId,
          instanceIp: instance.publicIp,
          containerId: containerInfo.containerId,
          workspacePath: containerInfo.workspacePath,
          ports: containerInfo.ports,
          userId: options.userId,
        },
      }

      this.logger.info('Session created successfully', {
        sessionId: session.id,
        instanceId: instance.instanceId,
        containerId: containerInfo.containerId,
      })

      // Emit session created event
      this.eventEmitter.emit('session:created', session)

      return session
    } catch (error) {
      // Release task if container creation fails
      await this.instancePool.releaseTask(instance.instanceId, options.taskId)
      throw error
    }
  }

  async executeTask(
    sessionId: string,
    task: string,
    options?: Record<string, any>
  ): Promise<TaskExecutionResult> {
    this.logger.info('Executing task in shared EC2 session', { sessionId, task })

    // Get container info by task ID
    const containerInfo = this.containerOrchestrator.getContainerByTaskId(sessionId)
    if (!containerInfo) {
      throw new Error(`No container found for task ${sessionId}`)
    }

    // Find instance for this container
    const instance = await this.findInstanceForTask(sessionId)
    if (!instance) {
      throw new Error(`No instance found for task ${sessionId}`)
    }

    try {
      // Execute task in container
      const startTime = Date.now()
      
      const result = await this.containerOrchestrator.executeInContainer(
        instance.publicIp,
        containerInfo.repository,
        task,
        options?.workDir
      )

      const executionTime = Date.now() - startTime

      const taskResult: TaskExecutionResult = {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        executionTime,
        metadata: {
          exitCode: result.exitCode,
          containerId: containerInfo.containerId,
        },
      }

      this.logger.info('Task executed successfully', {
        sessionId,
        success: taskResult.success,
        executionTime,
      })

      return taskResult
    } catch (error) {
      this.logger.error('Task execution failed', { sessionId, error })
      throw error
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    this.logger.info('Terminating shared EC2 session', { sessionId })

    // Get container info by task ID
    const containerInfo = this.containerOrchestrator.getContainerByTaskId(sessionId)
    if (!containerInfo) {
      this.logger.warn(`No container found for task ${sessionId}`)
      return
    }

    // Find instance for this session
    const instance = await this.findInstanceForTask(sessionId)
    if (!instance) {
      this.logger.warn(`No instance found for session ${sessionId}`)
      return
    }

    try {
      // Remove task from container
      await this.containerOrchestrator.removeTaskFromContainer(containerInfo.repository, sessionId)
      
      // Stop container if no more active tasks
      await this.containerOrchestrator.stopContainerIfEmpty(instance.publicIp, containerInfo.repository)
      
      // Release task from instance
      await this.instancePool.releaseTask(instance.instanceId, sessionId)
      
      this.logger.info('Session terminated successfully', { sessionId })
      
      // Emit session terminated event
      this.eventEmitter.emit('session:terminated', { sessionId })
    } catch (error) {
      this.logger.error('Failed to terminate session', { sessionId, error })
      throw error
    }
  }

  async getSessionStatus(sessionId: string): Promise<'active' | 'terminated' | 'unknown'> {
    const containerInfo = this.containerOrchestrator.getContainerByTaskId(sessionId)
    if (!containerInfo) {
      return 'unknown'
    }
    
    // Check if this task is still active in the container
    if (containerInfo.status === 'running' && containerInfo.activeTasks.has(sessionId)) {
      return 'active'
    }
    
    return 'terminated'
  }

  async getSessionLogs(sessionId: string, tail?: number): Promise<string> {
    const containerInfo = this.containerOrchestrator.getContainerByTaskId(sessionId)
    if (!containerInfo) {
      throw new Error(`No container found for task ${sessionId}`)
    }

    const instance = await this.findInstanceForTask(sessionId)
    if (!instance) {
      throw new Error(`No instance found for session ${sessionId}`)
    }

    return this.containerOrchestrator.getContainerLogs(
      instance.publicIp,
      containerInfo.repository,
      tail
    )
  }

  async uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const containerInfo = this.containerOrchestrator.getContainerInfo(sessionId)
    if (!containerInfo) {
      throw new Error(`No container found for session ${sessionId}`)
    }

    const instance = await this.findInstanceForTask(sessionId)
    if (!instance) {
      throw new Error(`No instance found for session ${sessionId}`)
    }

    // Upload file to container workspace
    const containerPath = `${containerInfo.workspacePath}/${remotePath}`
    
    // Use SCP through instance to container
    const scpCommand = `scp -P ${containerInfo.ports.ssh} ${localPath} container@${instance.publicIp}:${containerPath}`
    
    this.logger.info('Uploading file to container', {
      sessionId,
      localPath,
      remotePath: containerPath,
    })

    // Execute SCP command
    // Note: In production, this would use proper SSH key management
    await this.executeSystemCommand(scpCommand)
  }

  async downloadFile(
    sessionId: string,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const containerInfo = this.containerOrchestrator.getContainerInfo(sessionId)
    if (!containerInfo) {
      throw new Error(`No container found for session ${sessionId}`)
    }

    const instance = await this.findInstanceForTask(sessionId)
    if (!instance) {
      throw new Error(`No instance found for session ${sessionId}`)
    }

    // Download file from container workspace
    const containerPath = `${containerInfo.workspacePath}/${remotePath}`
    
    // Use SCP through instance from container
    const scpCommand = `scp -P ${containerInfo.ports.ssh} container@${instance.publicIp}:${containerPath} ${localPath}`
    
    this.logger.info('Downloading file from container', {
      sessionId,
      remotePath: containerPath,
      localPath,
    })

    // Execute SCP command
    await this.executeSystemCommand(scpCommand)
  }

  async listFiles(sessionId: string, directory: string): Promise<string[]> {
    const result = await this.executeTask(
      sessionId,
      `find ${directory} -type f -maxdepth 1 -printf "%f\\n" | sort`
    )
    
    return result.output
      .split('\n')
      .filter(line => line.trim())
  }

  // Monitoring and stats methods

  getPoolStats() {
    return this.instancePool.getPoolStats()
  }

  async getContainerStats() {
    const stats: Array<any> = []
    
    // Get stats from all instances
    for (const instance of this.getAllInstances()) {
      try {
        const instanceStats = await this.containerOrchestrator.getContainerStats(
          instance.publicIp
        )
        stats.push(...instanceStats.map(stat => ({
          ...stat,
          instanceId: instance.instanceId,
        })))
      } catch (error) {
        this.logger.warn('Failed to get stats from instance', {
          instanceId: instance.instanceId,
          error,
        })
      }
    }
    
    return stats
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener)
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener)
  }

  // Private helper methods

  private async findInstanceForTask(taskId: string): Promise<{ instanceId: string; publicIp: string } | null> {
    // In a real implementation, this would query a database or state store
    // For now, we'll iterate through instances to find the one running this task
    const containerInfo = this.containerOrchestrator.getContainerInfo(taskId)
    if (!containerInfo) {
      return null
    }

    // This is a simplified implementation
    // In production, we'd maintain a mapping of tasks to instances
    const instances = this.getAllInstances()
    
    // For POC, return the first available instance
    return instances[0] || null
  }

  private getAllInstances(): Array<{ instanceId: string; publicIp: string }> {
    // This would be properly implemented to get all instances from the pool
    // For POC, returning empty array
    return []
  }

  private async executeSystemCommand(command: string): Promise<void> {
    // This would execute system commands safely
    // For POC, just logging
    this.logger.info('Would execute system command', { command })
  }
}