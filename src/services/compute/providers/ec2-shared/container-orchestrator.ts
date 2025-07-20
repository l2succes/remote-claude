import { SSHClient } from '../../../utils/ssh-client'
import { Logger } from '../../../utils/logger'
import { v4 as uuidv4 } from 'uuid'

export interface ContainerConfig {
  repository: string
  branch?: string
  cpuLimit: string
  memoryLimit: string
  diskLimit: string
  environment?: Record<string, string>
}

export interface ContainerInfo {
  containerId: string
  repository: string
  status: 'running' | 'stopped' | 'error'
  startedAt: Date
  workspacePath: string
  activeTasks: Set<string>
  ports: {
    ssh: number
    websocket: number
  }
}

export class ContainerOrchestrator {
  private logger = new Logger('ContainerOrchestrator')
  private containers: Map<string, ContainerInfo> = new Map() // key is repository URL

  async getOrCreateContainer(
    instanceIp: string,
    config: ContainerConfig
  ): Promise<ContainerInfo> {
    // Check if container already exists for this repository
    const existing = this.containers.get(config.repository)
    if (existing && existing.status === 'running') {
      this.logger.info('Using existing container for repository', {
        repository: config.repository,
        containerId: existing.containerId,
      })
      return existing
    }

    const sshClient = new SSHClient(instanceIp)
    await sshClient.connect()

    try {
      // Generate a safe container name from repository URL
      const repoName = this.getRepoNameFromUrl(config.repository)
      const containerId = `repo-${repoName}-${uuidv4().slice(0, 8)}`
      const workspacePath = `/workspace/repos/${repoName}`
      
      // Generate random ports for this container
      const sshPort = this.generateRandomPort()
      const websocketPort = this.generateRandomPort()

      // Create workspace directory
      await sshClient.exec(`sudo mkdir -p ${workspacePath}`)
      await sshClient.exec(`sudo chown 1000:1000 ${workspacePath}`)

      // Clone repository
      const cloneCmd = config.branch 
        ? `git clone -b ${config.branch} ${config.repository} ${workspacePath}`
        : `git clone ${config.repository} ${workspacePath}`
      
      await sshClient.exec(cloneCmd)

      // Build Docker run command
      const dockerCmd = this.buildDockerCommand(containerId, config, workspacePath, {
        ssh: sshPort,
        websocket: websocketPort,
      })

      // Start container
      const result = await sshClient.exec(dockerCmd)
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to start container: ${result.stderr}`)
      }

      const containerInfo: ContainerInfo = {
        containerId,
        repository: config.repository,
        status: 'running',
        startedAt: new Date(),
        workspacePath,
        activeTasks: new Set<string>(),
        ports: {
          ssh: sshPort,
          websocket: websocketPort,
        },
      }

      this.containers.set(config.repository, containerInfo)
      
      this.logger.info('Container created', {
        containerId,
        repository: config.repository,
        ports: containerInfo.ports,
      })

      return containerInfo
    } finally {
      await sshClient.disconnect()
    }
  }

  // Add a task to an existing container
  async addTaskToContainer(repository: string, taskId: string): Promise<void> {
    const containerInfo = this.containers.get(repository)
    if (!containerInfo) {
      throw new Error(`No container found for repository ${repository}`)
    }

    containerInfo.activeTasks.add(taskId)
    this.logger.info('Task added to container', {
      taskId,
      repository,
      containerId: containerInfo.containerId,
      activeTasks: containerInfo.activeTasks.size,
    })
  }

  // Remove a task from a container
  async removeTaskFromContainer(repository: string, taskId: string): Promise<void> {
    const containerInfo = this.containers.get(repository)
    if (!containerInfo) {
      this.logger.warn(`No container found for repository ${repository}`)
      return
    }

    containerInfo.activeTasks.delete(taskId)
    this.logger.info('Task removed from container', {
      taskId,
      repository,
      containerId: containerInfo.containerId,
      activeTasks: containerInfo.activeTasks.size,
    })
  }

  // Stop container when no active tasks
  async stopContainerIfEmpty(instanceIp: string, repository: string): Promise<void> {
    const containerInfo = this.containers.get(repository)
    if (!containerInfo) {
      this.logger.warn(`Container for repository ${repository} not found`)
      return
    }

    if (containerInfo.activeTasks.size > 0) {
      this.logger.info('Container still has active tasks, not stopping', {
        repository,
        activeTasks: containerInfo.activeTasks.size,
      })
      return
    }

    const sshClient = new SSHClient(instanceIp)
    await sshClient.connect()

    try {
      // Stop container
      await sshClient.exec(`docker stop ${containerInfo.containerId}`)
      
      // Remove container
      await sshClient.exec(`docker rm ${containerInfo.containerId}`)
      
      // Archive workspace (optional)
      const archivePath = `/archive/${containerInfo.userId}/${containerInfo.taskId}`
      await sshClient.exec(`sudo mkdir -p ${archivePath}`)
      await sshClient.exec(
        `sudo tar -czf ${archivePath}/workspace.tar.gz -C ${containerInfo.workspacePath} .`
      )
      
      // Clean up workspace
      await sshClient.exec(`sudo rm -rf ${containerInfo.workspacePath}`)
      
      this.containers.delete(taskId)
      
      this.logger.info('Container stopped and cleaned up', {
        containerId: containerInfo.containerId,
        taskId,
      })
    } finally {
      await sshClient.disconnect()
    }
  }

  async getContainerLogs(
    instanceIp: string,
    repository: string,
    tail?: number
  ): Promise<string> {
    const containerInfo = this.containers.get(repository)
    if (!containerInfo) {
      throw new Error(`Container for repository ${repository} not found`)
    }

    const sshClient = new SSHClient(instanceIp)
    await sshClient.connect()

    try {
      const tailFlag = tail ? `--tail ${tail}` : ''
      const result = await sshClient.exec(
        `docker logs ${tailFlag} ${containerInfo.containerId}`
      )
      
      return result.stdout + result.stderr
    } finally {
      await sshClient.disconnect()
    }
  }

  async executeInContainer(
    instanceIp: string,
    repository: string,
    command: string,
    workDir?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerInfo = this.containers.get(repository)
    if (!containerInfo) {
      throw new Error(`Container for repository ${repository} not found`)
    }

    const sshClient = new SSHClient(instanceIp)
    await sshClient.connect()

    try {
      const workingDir = workDir || containerInfo.workspacePath
      const dockerExec = `docker exec -w ${workingDir} ${containerInfo.containerId} ${command}`
      return await sshClient.exec(dockerExec)
    } finally {
      await sshClient.disconnect()
    }
  }

  async getContainerStats(instanceIp: string): Promise<Array<{
    taskId: string
    cpu: number
    memory: number
    networkIn: number
    networkOut: number
  }>> {
    const sshClient = new SSHClient(instanceIp)
    await sshClient.connect()

    try {
      const result = await sshClient.exec(
        'docker stats --no-stream --format "{{json .}}"'
      )
      
      const stats = result.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .filter(stat => stat.Name.startsWith('task-'))
        .map(stat => {
          const taskId = this.getTaskIdFromContainerName(stat.Name)
          return {
            taskId,
            cpu: parseFloat(stat.CPUPerc.replace('%', '')),
            memory: this.parseMemory(stat.MemUsage),
            networkIn: this.parseNetwork(stat.NetIO.split('/')[0]),
            networkOut: this.parseNetwork(stat.NetIO.split('/')[1]),
          }
        })
      
      return stats
    } finally {
      await sshClient.disconnect()
    }
  }

  private buildDockerCommand(
    containerId: string,
    config: ContainerConfig,
    workspacePath: string,
    ports: { ssh: number; websocket: number }
  ): string {
    const envFlags = Object.entries(config.environment || {})
      .map(([key, value]) => `-e ${key}="${value}"`)
      .join(' ')

    return `docker run -d \\
      --name ${containerId} \\
      --hostname ${containerId} \\
      --cpus="${config.cpuLimit}" \\
      --memory="${config.memoryLimit}" \\
      --storage-opt size=${config.diskLimit} \\
      -v ${workspacePath}:/workspace \\
      -v /tmp/${config.userId}/${config.taskId}:/tmp \\
      -p ${ports.ssh}:22 \\
      -p ${ports.websocket}:8080 \\
      -e TASK_ID="${config.taskId}" \\
      -e USER_ID="${config.userId}" \\
      -e WORKSPACE="/workspace" \\
      ${envFlags} \\
      --network isolated-${config.userId} \\
      --cap-drop ALL \\
      --cap-add CHOWN \\
      --cap-add SETUID \\
      --cap-add SETGID \\
      --security-opt no-new-privileges:true \\
      --read-only \\
      --tmpfs /run:noexec,nosuid,size=65536k \\
      anthropic/claude-code:latest`
  }

  private generateRandomPort(): number {
    // Generate random port between 30000-40000
    return Math.floor(Math.random() * 10000) + 30000
  }

  private getTaskIdFromContainerName(containerName: string): string {
    // Extract task ID from container name format: task-{taskId}-{uuid}
    const parts = containerName.split('-')
    return parts[1]
  }

  private parseMemory(memUsage: string): number {
    // Parse Docker memory usage format: "100MiB / 2GiB"
    const used = memUsage.split('/')[0].trim()
    const match = used.match(/(\d+(?:\.\d+)?)\s*([KMGT]iB)/)
    
    if (!match) return 0
    
    const value = parseFloat(match[1])
    const unit = match[2]
    
    const multipliers: Record<string, number> = {
      'KiB': 1024,
      'MiB': 1024 * 1024,
      'GiB': 1024 * 1024 * 1024,
      'TiB': 1024 * 1024 * 1024 * 1024,
    }
    
    return value * (multipliers[unit] || 1)
  }

  private parseNetwork(networkIO: string): number {
    // Parse Docker network I/O format: "100MB"
    const match = networkIO.trim().match(/(\d+(?:\.\d+)?)\s*([KMGT]B)/)
    
    if (!match) return 0
    
    const value = parseFloat(match[1])
    const unit = match[2]
    
    const multipliers: Record<string, number> = {
      'KB': 1000,
      'MB': 1000 * 1000,
      'GB': 1000 * 1000 * 1000,
      'TB': 1000 * 1000 * 1000 * 1000,
    }
    
    return value * (multipliers[unit] || 1)
  }

  getContainerInfo(repository: string): ContainerInfo | undefined {
    return this.containers.get(repository)
  }

  getContainerByTaskId(taskId: string): ContainerInfo | undefined {
    // Find container that has this task
    for (const container of this.containers.values()) {
      if (container.activeTasks.has(taskId)) {
        return container
      }
    }
    return undefined
  }

  getAllContainers(): ContainerInfo[] {
    return Array.from(this.containers.values())
  }

  private getRepoNameFromUrl(repoUrl: string): string {
    // Extract repository name from URL
    // https://github.com/user/repo.git -> user-repo
    // git@github.com:user/repo.git -> user-repo
    
    let cleanUrl = repoUrl.replace(/\.git$/, '')
    
    if (cleanUrl.includes('github.com')) {
      const match = cleanUrl.match(/github\.com[:/]([^/]+)\/([^/]+)/)
      if (match) {
        return `${match[1]}-${match[2]}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      }
    }
    
    // Fallback: use last part of URL
    const parts = cleanUrl.split('/')
    return parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }
}