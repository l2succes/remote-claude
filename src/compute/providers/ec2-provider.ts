/**
 * EC2Provider - Amazon EC2 compute provider implementation
 */

import { EventEmitter } from 'events'
import { 
  EC2Client, 
  RunInstancesCommand, 
  TerminateInstancesCommand,
  DescribeInstancesCommand,
  CreateTagsCommand,
  Instance,
  InstanceState,
  _InstanceType
} from '@aws-sdk/client-ec2'
import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm'
import { Client as SSHClient, ConnectConfig } from 'ssh2'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
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
  EC2Config
} from '../types'

export class EC2Provider extends EventEmitter implements ComputeProvider {
  readonly name = 'Amazon EC2'
  readonly type = ComputeProviderType.EC2

  private ec2Client: EC2Client
  private ssmClient: SSMClient
  private config: EC2Config
  private activeConnections: Map<string, SSHClient> = new Map()

  constructor(config: EC2Config) {
    super()
    this.config = config
    
    // Initialize AWS clients
    this.ec2Client = new EC2Client({ 
      region: config.region,
      // AWS SDK will automatically use credentials from environment, IAM roles, or AWS config
    })
    
    this.ssmClient = new SSMClient({ 
      region: config.region 
    })
  }

  /**
   * Validate EC2 configuration
   */
  async validateConfig(config: EC2Config): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (!config.region) {
      errors.push('AWS region is required')
    }

    if (!config.instanceType) {
      errors.push('EC2 instance type is required')
    }

    // Validation warnings
    if (config.idleTimeout && config.idleTimeout < 30) {
      warnings.push('Idle timeout less than 30 minutes may cause frequent terminations')
    }

    if (config.spotInstance) {
      warnings.push('Spot instances may be interrupted unexpectedly')
    }

    // Validate region format
    if (config.region && !/^[a-z]{2}-[a-z]+-\d+$/.test(config.region)) {
      errors.push('Invalid AWS region format')
    }

    // Validate instance type format
    if (config.instanceType && !/^[a-z]\d+\.[a-z0-9]+$/.test(config.instanceType)) {
      errors.push('Invalid EC2 instance type format')
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
      supportsSpotInstances: true,
      supportsPersistentStorage: true,
      supportsCustomImages: true,
      supportsDockerContainers: true,
      maxConcurrentTasks: 10,
      maxTaskDuration: 24 * 60 * 60 * 1000 // 24 hours
    }
  }

  /**
   * Create a new EC2 instance environment
   */
  async createEnvironment(options: EnvironmentOptions = {}): Promise<Environment> {
    const instanceType = options.machineType || this.config.instanceType
    const displayName = options.name || `remote-claude-${Date.now()}`

    // Build run instances command
    const runCommand = new RunInstancesCommand({
      ImageId: this.config.ami || await this.getDefaultAMI(),
      InstanceType: instanceType as _InstanceType,
      MinCount: 1,
      MaxCount: 1,
      KeyName: options.metadata?.keyPair || this.config.keyPair,
      SecurityGroupIds: options.metadata?.securityGroups || this.config.securityGroupIds,
      SubnetId: options.metadata?.subnetId || this.config.subnetId,
      UserData: this.generateUserData(),
      TagSpecifications: [{
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: displayName },
          { Key: 'CreatedBy', Value: 'EC2Provider' },
          // Add default Project tag if not provided in config
          ...(!(this.config.tags && 'Project' in this.config.tags) ? [{ Key: 'Project', Value: 'remote-claude' }] : []),
          // Add custom tags, filtering out reserved keys
          ...Object.entries(this.config.tags || {})
            .filter(([key]) => !['Name', 'CreatedBy'].includes(key))
            .map(([key, value]) => ({ Key: key, Value: value }))
        ]
      }],
      ...(this.config.spotInstance && {
        InstanceMarketOptions: {
          MarketType: 'spot',
          SpotOptions: {
            SpotInstanceType: 'one-time'
          }
        }
      })
    })

    const result = await this.ec2Client.send(runCommand)
    const instance = result.Instances?.[0]

    if (!instance || !instance.InstanceId) {
      throw new Error('Failed to create EC2 instance')
    }

    // Wait for instance to be running
    await this.waitForInstanceRunning(instance.InstanceId)

    // Get updated instance details
    const updatedInstance = await this.getInstanceDetails(instance.InstanceId)

    const environment: Environment = {
      id: instance.InstanceId,
      provider: this.type,
      status: this.mapInstanceState(updatedInstance.State?.Name || 'unknown'),
      createdAt: new Date(),
      metadata: {
        instanceId: instance.InstanceId,
        instanceType,
        region: this.config.region,
        spotInstance: this.config.spotInstance,
        publicIp: updatedInstance.PublicIpAddress,
        privateIp: updatedInstance.PrivateIpAddress,
        keyPair: this.config.keyPair,
        displayName
      }
    }

    this.emit('environment-created', environment)
    return environment
  }

  /**
   * Destroy an EC2 instance environment
   */
  async destroyEnvironment(envId: string): Promise<void> {
    // Close any active SSH connections
    const connection = this.activeConnections.get(envId)
    if (connection) {
      connection.end()
      this.activeConnections.delete(envId)
    }

    // Terminate the instance
    const command = new TerminateInstancesCommand({
      InstanceIds: [envId]
    })

    await this.ec2Client.send(command)
    this.emit('environment-destroyed', envId)
  }

  /**
   * Get environment status
   */
  async getEnvironmentStatus(envId: string): Promise<EnvironmentStatus> {
    const instance = await this.getInstanceDetails(envId)
    return this.mapInstanceState(instance.State?.Name || 'unknown')
  }

  /**
   * List all environments (EC2 instances with our tags)
   */
  async listEnvironments(): Promise<Environment[]> {
    const command = new DescribeInstancesCommand({
      Filters: [
        { Name: 'tag:Project', Values: ['remote-claude'] },
        { Name: 'instance-state-name', Values: ['pending', 'running', 'stopping', 'stopped'] }
      ]
    })

    const result = await this.ec2Client.send(command)
    const environments: Environment[] = []

    for (const reservation of result.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        if (instance.InstanceId) {
          const displayName = instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId

          environments.push({
            id: instance.InstanceId,
            provider: this.type,
            status: this.mapInstanceState(instance.State?.Name || 'unknown'),
            createdAt: new Date(instance.LaunchTime || Date.now()),
            metadata: {
              instanceId: instance.InstanceId,
              instanceType: instance.InstanceType,
              region: this.config.region,
              publicIp: instance.PublicIpAddress,
              privateIp: instance.PrivateIpAddress,
              displayName
            }
          })
        }
      }
    }

    return environments
  }

  /**
   * Execute a task on an EC2 instance
   */
  async executeTask(env: Environment, task: TaskDefinition): Promise<TaskExecution> {
    const execution: TaskExecution = {
      id: task.id,
      environmentId: env.id,
      status: TaskStatus.RUNNING,
      startTime: new Date()
    }

    try {
      // Upload files if provided
      if (task.files) {
        await this.uploadFiles(env.id, task.files)
      }

      // Install Claude Code if not already installed
      await this.ensureClaudeCodeInstalled(env)

      // Execute the command via SSH
      const result = await this.executeCommandViaSSH(env, task.command, task.environment)

      execution.status = result.exitCode === 0 ? TaskStatus.COMPLETED : TaskStatus.FAILED
      execution.endTime = new Date()
      execution.exitCode = result.exitCode
      execution.output = result.stdout
      execution.error = result.stderr

      this.emit(execution.status === TaskStatus.COMPLETED ? 'task-completed' : 'task-failed', execution)
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
   * Get task status (for EC2, tasks don't persist separately)
   */
  async getTaskStatus(envId: string, taskId: string): Promise<TaskStatus> {
    // For EC2, we don't track individual tasks separately
    // Could be enhanced to track via process monitoring
    return TaskStatus.COMPLETED
  }

  /**
   * Cancel a running task
   */
  async cancelTask(envId: string, taskId: string): Promise<void> {
    // Send SIGTERM to any running processes (simplified implementation)
    // In practice, this would need more sophisticated process tracking
    try {
      const env = { id: envId, metadata: {} } as Environment
      await this.executeCommandViaSSH(env, 'pkill -f claude', {})
    } catch (error) {
      // Ignore errors - task might already be complete
    }
    
    this.emit('task-cancelled', { envId, taskId })
  }

  /**
   * Stream logs from environment
   */
  async streamLogs(envId: string, callback: LogCallback): Promise<void> {
    // For EC2, we could tail system logs or application logs
    // This is a simplified implementation
    try {
      const env = { id: envId, metadata: {} } as Environment
      await this.executeCommandViaSSH(env, 'tail -f /var/log/claude-*.log 2>/dev/null || echo "No logs available"', {}, {
        onData: callback
      })
    } catch (error) {
      callback(`Error streaming logs: ${(error as Error).message}\n`)
    }
  }

  /**
   * Upload files to EC2 instance
   */
  async uploadFiles(envId: string, files: FileMap): Promise<void> {
    const instance = await this.getInstanceDetails(envId)
    const connection = await this.getSSHConnection(instance)

    return new Promise((resolve, reject) => {
      connection.sftp((err, sftp) => {
        if (err) {
          reject(err)
          return
        }

        const uploads = Object.entries(files).map(([remotePath, content]) => {
          return new Promise<void>((resolveUpload, rejectUpload) => {
            const data = typeof content === 'string' ? content : content.toString()
            sftp.writeFile(remotePath, data, (writeErr) => {
              if (writeErr) {
                rejectUpload(writeErr)
              } else {
                resolveUpload()
              }
            })
          })
        })

        Promise.all(uploads)
          .then(() => {
            sftp.end()
            resolve()
          })
          .catch(reject)
      })
    })
  }

  /**
   * Download files from EC2 instance
   */
  async downloadResults(envId: string, paths: string[]): Promise<FileMap> {
    const instance = await this.getInstanceDetails(envId)
    const connection = await this.getSSHConnection(instance)
    const files: FileMap = {}

    return new Promise((resolve, reject) => {
      connection.sftp((err, sftp) => {
        if (err) {
          reject(err)
          return
        }

        const downloads = paths.map((path) => {
          return new Promise<void>((resolveDownload, rejectDownload) => {
            sftp.readFile(path, (readErr, data) => {
              if (readErr) {
                // File might not exist, log but continue
                console.warn(`Failed to download ${path}:`, readErr.message)
                resolveDownload()
              } else {
                files[path] = data.toString()
                resolveDownload()
              }
            })
          })
        })

        Promise.all(downloads)
          .then(() => {
            sftp.end()
            resolve(files)
          })
          .catch(reject)
      })
    })
  }

  /**
   * Get instance details from AWS
   */
  private async getInstanceDetails(instanceId: string): Promise<Instance> {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    })

    const result = await this.ec2Client.send(command)
    const instance = result.Reservations?.[0]?.Instances?.[0]

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`)
    }

    return instance
  }

  /**
   * Wait for instance to be in running state
   */
  private async waitForInstanceRunning(instanceId: string, maxAttempts = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const instance = await this.getInstanceDetails(instanceId)
      
      if (instance.State?.Name === 'running') {
        // Wait a bit more for SSH to be ready
        await new Promise(resolve => setTimeout(resolve, 30000))
        return
      }
      
      if (instance.State?.Name === 'shutting-down' || instance.State?.Name === 'stopped') {
        throw new Error('Instance was terminated during startup')
      }
      
      // Wait 10 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
    
    throw new Error(`Instance ${instanceId} not ready after ${maxAttempts * 10} seconds`)
  }

  /**
   * Get SSH connection to instance
   */
  private async getSSHConnection(instance: Instance): Promise<SSHClient> {
    const instanceId = instance.InstanceId!
    
    // Check for existing connection
    const existing = this.activeConnections.get(instanceId)
    if (existing) {
      return existing
    }

    const connection = new SSHClient()
    
    const host = instance.PublicIpAddress || instance.PrivateIpAddress
    if (!host) {
      throw new Error('Instance has no public or private IP address')
    }

    const connectConfig: ConnectConfig = {
      host,
      port: 22,
      username: 'ec2-user', // Default for Amazon Linux
      ...(this.config.keyPair && {
        privateKey: await this.loadSSHKey(this.config.keyPair)
      })
    }

    return new Promise((resolve, reject) => {
      connection.on('ready', () => {
        this.activeConnections.set(instanceId, connection)
        resolve(connection)
      })

      connection.on('error', (err) => {
        reject(err)
      })

      connection.connect(connectConfig)
    })
  }

  /**
   * Execute command via SSH
   */
  private async executeCommandViaSSH(
    env: Environment, 
    command: string, 
    environment: Record<string, string> = {},
    options: { onData?: (data: string) => void } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const instance = await this.getInstanceDetails(env.id)
    const connection = await this.getSSHConnection(instance)

    // Build environment variables
    const envVars = Object.entries(environment)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join('; ')

    const fullCommand = envVars ? `${envVars}; ${command}` : command

    return new Promise((resolve, reject) => {
      connection.exec(fullCommand, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let stdout = ''
        let stderr = ''
        let exitCode = 0

        stream.on('data', (data: Buffer) => {
          const text = data.toString()
          stdout += text
          if (options.onData) {
            options.onData(text)
          }
        })

        stream.stderr.on('data', (data: Buffer) => {
          const text = data.toString()
          stderr += text
          if (options.onData) {
            options.onData(text)
          }
        })

        stream.on('exit', (code: number) => {
          exitCode = code || 0
        })

        stream.on('end', () => {
          resolve({ stdout, stderr, exitCode })
        })
      })
    })
  }

  /**
   * Ensure Claude Code is installed on the instance
   */
  private async ensureClaudeCodeInstalled(env: Environment): Promise<void> {
    try {
      // Check if Claude Code is already installed
      await this.executeCommandViaSSH(env, 'which claude', {})
      return // Already installed
    } catch {
      // Not installed, proceed with installation
    }

    // Install Claude Code
    await this.executeCommandViaSSH(env, 'sudo npm install -g @anthropic-ai/claude-code', {})
    
    // Verify installation
    await this.executeCommandViaSSH(env, 'claude --version', {})
  }

  /**
   * Copy SSH public key to instance for passwordless access
   */
  async copySSHKey(env: Environment, options: {
    publicKeyPath?: string; // Path to public key file
    privateKeyPath?: string; // Path to private key (for GitHub access)
    setupGitHubAccess?: boolean; // Set up GitHub SSH config
  }): Promise<void> {
    // Expand tilde in paths
    const expandPath = (path: string) => path.replace(/^~/, homedir())
    
    // Auto-detect public key if not specified
    let publicKeyPath: string
    if (options.publicKeyPath) {
      publicKeyPath = expandPath(options.publicKeyPath)
    } else {
      // Try common key locations
      const keyPaths = [
        join(homedir(), '.ssh', 'id_ed25519.pub'),
        join(homedir(), '.ssh', 'id_rsa.pub'),
        join(homedir(), '.ssh', 'id_ecdsa.pub')
      ]
      
      for (const path of keyPaths) {
        try {
          await readFile(path)
          publicKeyPath = path
          console.log(`📁 Using public key: ${path}`)
          break
        } catch {
          // Continue to next key
        }
      }
      
      if (!publicKeyPath!) {
        throw new Error('No SSH public key found. Specify with --public-key')
      }
    }
    
    try {
      // Read the public key
      const publicKey = await readFile(publicKeyPath, 'utf8')
      
      console.log(`📤 Copying SSH key to instance ${env.id}...`)
      
      // Create .ssh directory and set permissions
      await this.executeCommandViaSSH(env, 'mkdir -p ~/.ssh && chmod 700 ~/.ssh')
      
      // Add public key to authorized_keys
      await this.executeCommandViaSSH(env, `echo '${publicKey.trim()}' >> ~/.ssh/authorized_keys`)
      await this.executeCommandViaSSH(env, 'chmod 600 ~/.ssh/authorized_keys')
      
      console.log('✅ SSH key copied successfully')
      
      // Set up GitHub access if private key provided
      if (options.privateKeyPath && options.setupGitHubAccess) {
        const privateKeyPath = expandPath(options.privateKeyPath)
        const privateKey = await readFile(privateKeyPath, 'utf8')
        
        // Copy private key for GitHub access
        await this.executeCommandViaSSH(env, `cat > ~/.ssh/github_key << 'EOF'\n${privateKey}\nEOF`)
        await this.executeCommandViaSSH(env, 'chmod 600 ~/.ssh/github_key')
        
        // Set up SSH config for GitHub
        const sshConfig = `Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_key
  StrictHostKeyChecking no`
        
        await this.executeCommandViaSSH(env, `cat > ~/.ssh/config << 'EOF'\n${sshConfig}\nEOF`)
        await this.executeCommandViaSSH(env, 'chmod 600 ~/.ssh/config')
        
        console.log('✅ GitHub SSH access configured')
      }
      
    } catch (error) {
      throw new Error(`Failed to copy SSH key: ${(error as Error).message}`)
    }
  }

  /**
   * Set up secure Git access on the instance
   */
  async setupGitAccess(env: Environment, options: {
    deployKey?: string; // Path to deploy key
    gitConfig?: { name: string; email: string; };
    repositories?: string[]; // Repositories to clone
  }): Promise<void> {
    // Configure Git user if provided
    if (options.gitConfig) {
      await this.executeCommandViaSSH(env, `git config --global user.name "${options.gitConfig.name}"`)
      await this.executeCommandViaSSH(env, `git config --global user.email "${options.gitConfig.email}"`)
    }

    // Set up deploy key if provided
    if (options.deployKey) {
      try {
        // Read the deploy key
        const deployKeyContent = await readFile(options.deployKey, 'utf8')
        
        // Create .ssh directory and set permissions
        await this.executeCommandViaSSH(env, 'mkdir -p ~/.ssh && chmod 700 ~/.ssh')
        
        // Upload deploy key (securely via SSH)
        await this.executeCommandViaSSH(env, `cat > ~/.ssh/deploy_key << 'EOF'\n${deployKeyContent}\nEOF`)
        await this.executeCommandViaSSH(env, 'chmod 600 ~/.ssh/deploy_key')
        
        // Configure SSH to use deploy key for GitHub
        const sshConfig = `Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/deploy_key
  StrictHostKeyChecking no`
        
        await this.executeCommandViaSSH(env, `cat > ~/.ssh/config << 'EOF'\n${sshConfig}\nEOF`)
        await this.executeCommandViaSSH(env, 'chmod 600 ~/.ssh/config')
        
        console.log('✅ Deploy key configured for GitHub access')
      } catch (error) {
        throw new Error(`Failed to set up deploy key: ${(error as Error).message}`)
      }
    }

    // Clone repositories if specified
    if (options.repositories) {
      for (const repo of options.repositories) {
        try {
          await this.executeCommandViaSSH(env, `git clone git@github.com:${repo}.git`)
          console.log(`✅ Cloned repository: ${repo}`)
        } catch (error) {
          console.warn(`⚠️  Failed to clone ${repo}: ${(error as Error).message}`)
        }
      }
    }
  }

  /**
   * Load SSH private key
   */
  private async loadSSHKey(keyName: string): Promise<Buffer> {
    // Try common SSH key locations
    const possiblePaths = [
      join(homedir(), '.ssh', keyName),
      join(homedir(), '.ssh', `${keyName}.pem`),
      join(homedir(), '.ssh', 'id_rsa'),
      keyName // Treat as absolute path
    ]

    for (const path of possiblePaths) {
      try {
        return await readFile(path)
      } catch {
        // Continue to next path
      }
    }

    throw new Error(`SSH key not found. Tried: ${possiblePaths.join(', ')}`)
  }

  /**
   * Generate user data script for instance initialization
   */
  private generateUserData(): string {
    const script = `#!/bin/bash
# Remote Claude EC2 Setup Script

# Update system
yum update -y

# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install Docker
yum install -y docker
systemctl enable docker
systemctl start docker
usermod -a -G docker ec2-user

# Install common development tools
yum install -y git tmux htop curl wget unzip

# Create directories
mkdir -p /opt/remote-claude
chown ec2-user:ec2-user /opt/remote-claude

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Setup auto-shutdown script
cat > /opt/remote-claude/auto-shutdown.sh << 'EOF'
#!/bin/bash
IDLE_TIME=${this.config.idleTimeout || 60}
while true; do
  LOAD=$(uptime | awk '{print $10}' | sed 's/,//')
  CONNECTIONS=$(ss -t state established | wc -l)
  
  if (( \$(echo "$LOAD < 0.1" | bc -l) )) && [ "$CONNECTIONS" -lt 3 ]; then
    ((IDLE_COUNT++))
    if [ "$IDLE_COUNT" -gt "$IDLE_TIME" ]; then
      echo "System idle for $IDLE_TIME minutes, shutting down..."
      sudo shutdown -h now
    fi
  else
    IDLE_COUNT=0
  fi
  
  sleep 60
done
EOF

chmod +x /opt/remote-claude/auto-shutdown.sh

# Start auto-shutdown in background if enabled
${this.config.autoTerminate ? 'nohup /opt/remote-claude/auto-shutdown.sh > /var/log/auto-shutdown.log 2>&1 &' : '# Auto-shutdown disabled'}

# Signal completion
touch /opt/remote-claude/setup-complete
`

    return Buffer.from(script).toString('base64')
  }

  /**
   * Get default AMI for the region
   */
  private async getDefaultAMI(): Promise<string> {
    // Amazon Linux 2023 AMI IDs (updated for glibc 2.34+ compatibility)
    // These support Node.js 18+ and Claude Code installation
    const defaultAMIs: Record<string, string> = {
      'us-east-1': 'ami-0ae8f15ae66fe8cda',
      'us-west-2': 'ami-008d8ed4bd7dc2485',
      'eu-west-1': 'ami-01dd271720c1ba44f',
      'ap-southeast-1': 'ami-047126e50991d067b'
    }

    return defaultAMIs[this.config.region] || defaultAMIs['us-east-1']!
  }

  /**
   * Map EC2 instance state to environment status
   */
  private mapInstanceState(state: string): EnvironmentStatus {
    switch (state) {
      case 'pending':
        return EnvironmentStatus.CREATING
      case 'running':
        return EnvironmentStatus.RUNNING
      case 'stopping':
        return EnvironmentStatus.STOPPING
      case 'stopped':
        return EnvironmentStatus.STOPPED
      case 'terminated':
      case 'terminating':
        return EnvironmentStatus.STOPPED
      default:
        return EnvironmentStatus.ERROR
    }
  }
}