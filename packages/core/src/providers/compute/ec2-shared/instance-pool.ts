import { EC2Client, RunInstancesCommand, TerminateInstancesCommand, DescribeInstancesCommand, Instance } from '@aws-sdk/client-ec2'
import { Logger } from '@remote-claude/core/utils/logger'
import { getConfig } from '@remote-claude/core/utils/config'

export interface PooledInstance {
  instanceId: string
  publicIp: string
  privateIp: string
  state: 'idle' | 'busy' | 'draining'
  runningTasks: number
  maxTasks: number
  createdAt: Date
  lastActivityAt: Date
}

export interface PoolConfig {
  minInstances: number
  maxInstances: number
  maxTasksPerInstance: number
  instanceType: string
  idleTimeout: number // seconds
  scaleUpThreshold: number // 0-1
  scaleDownThreshold: number // 0-1
}

export class EC2InstancePool {
  private logger = new Logger('EC2InstancePool')
  private ec2Client: EC2Client
  private instances: Map<string, PooledInstance> = new Map()
  private config: PoolConfig
  private healthCheckInterval?: NodeJS.Timeout
  private scaleInterval?: NodeJS.Timeout

  constructor(config: PoolConfig) {
    this.config = config
    this.ec2Client = new EC2Client({
      region: getConfig('aws.region'),
      credentials: {
        accessKeyId: getConfig('aws.accessKeyId'),
        secretAccessKey: getConfig('aws.secretAccessKey'),
      },
    })
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing EC2 instance pool', { config: this.config })
    
    // Start with minimum instances
    await this.scaleToSize(this.config.minInstances)
    
    // Start monitoring
    this.startHealthChecks()
    this.startAutoScaling()
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down instance pool')
    
    // Stop monitoring
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval)
    if (this.scaleInterval) clearInterval(this.scaleInterval)
    
    // Terminate all instances
    const instanceIds = Array.from(this.instances.keys())
    if (instanceIds.length > 0) {
      await this.terminateInstances(instanceIds)
    }
  }

  async getAvailableInstance(): Promise<PooledInstance | null> {
    // Find instance with capacity
    for (const instance of this.instances.values()) {
      if (instance.state === 'idle' || 
          (instance.state === 'busy' && instance.runningTasks < instance.maxTasks)) {
        return instance
      }
    }
    
    // Try to scale up if possible
    if (this.instances.size < this.config.maxInstances) {
      this.logger.info('No available instances, scaling up')
      await this.scaleUp(1)
      // Retry after scale up
      return this.getAvailableInstance()
    }
    
    return null
  }

  async assignTask(instanceId: string, taskId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found in pool`)
    }
    
    instance.runningTasks++
    instance.lastActivityAt = new Date()
    instance.state = instance.runningTasks >= instance.maxTasks ? 'busy' : 'idle'
    
    this.logger.info('Task assigned to instance', {
      instanceId,
      taskId,
      runningTasks: instance.runningTasks,
      state: instance.state,
    })
  }

  async releaseTask(instanceId: string, taskId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      this.logger.warn(`Instance ${instanceId} not found when releasing task ${taskId}`)
      return
    }
    
    instance.runningTasks = Math.max(0, instance.runningTasks - 1)
    instance.lastActivityAt = new Date()
    instance.state = instance.runningTasks === 0 ? 'idle' : 'busy'
    
    this.logger.info('Task released from instance', {
      instanceId,
      taskId,
      runningTasks: instance.runningTasks,
      state: instance.state,
    })
  }

  private async scaleToSize(targetSize: number): Promise<void> {
    const currentSize = this.instances.size
    
    if (targetSize > currentSize) {
      await this.scaleUp(targetSize - currentSize)
    } else if (targetSize < currentSize) {
      await this.scaleDown(currentSize - targetSize)
    }
  }

  private async scaleUp(count: number): Promise<void> {
    this.logger.info(`Scaling up by ${count} instances`)
    
    const userData = this.generateUserData()
    
    const command = new RunInstancesCommand({
      ImageId: getConfig('ec2.amiId'),
      InstanceType: this.config.instanceType,
      MinCount: count,
      MaxCount: count,
      KeyName: getConfig('ec2.keyName'),
      SecurityGroupIds: [getConfig('ec2.securityGroupId')],
      SubnetId: getConfig('ec2.subnetId'),
      UserData: Buffer.from(userData).toString('base64'),
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            { Key: 'Name', Value: 'remote-claude-shared' },
            { Key: 'Pool', Value: 'shared' },
            { Key: 'ManagedBy', Value: 'remote-claude' },
          ],
        },
      ],
    })
    
    const response = await this.ec2Client.send(command)
    
    if (response.Instances) {
      for (const instance of response.Instances) {
        if (instance.InstanceId) {
          this.instances.set(instance.InstanceId, {
            instanceId: instance.InstanceId,
            publicIp: instance.PublicIpAddress || '',
            privateIp: instance.PrivateIpAddress || '',
            state: 'idle',
            runningTasks: 0,
            maxTasks: this.config.maxTasksPerInstance,
            createdAt: new Date(),
            lastActivityAt: new Date(),
          })
        }
      }
    }
  }

  private async scaleDown(count: number): Promise<void> {
    this.logger.info(`Scaling down by ${count} instances`)
    
    // Find idle instances to terminate
    const idleInstances = Array.from(this.instances.values())
      .filter(i => i.state === 'idle')
      .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())
      .slice(0, count)
    
    const instanceIds = idleInstances.map(i => i.instanceId)
    
    if (instanceIds.length > 0) {
      await this.terminateInstances(instanceIds)
      instanceIds.forEach(id => this.instances.delete(id))
    }
  }

  private async terminateInstances(instanceIds: string[]): Promise<void> {
    const command = new TerminateInstancesCommand({ InstanceIds: instanceIds })
    await this.ec2Client.send(command)
    this.logger.info(`Terminated instances: ${instanceIds.join(', ')}`)
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks()
    }, 60000) // Every minute
  }

  private async performHealthChecks(): Promise<void> {
    // Check instance health
    const instanceIds = Array.from(this.instances.keys())
    
    if (instanceIds.length === 0) return
    
    const command = new DescribeInstancesCommand({ InstanceIds: instanceIds })
    const response = await this.ec2Client.send(command)
    
    if (response.Reservations) {
      for (const reservation of response.Reservations) {
        if (reservation.Instances) {
          for (const instance of reservation.Instances) {
            if (instance.InstanceId && instance.State?.Name !== 'running') {
              this.logger.warn(`Instance ${instance.InstanceId} is not running`, {
                state: instance.State?.Name,
              })
              this.instances.delete(instance.InstanceId)
            }
          }
        }
      }
    }
    
    // Check idle timeout
    const now = Date.now()
    for (const instance of this.instances.values()) {
      if (instance.state === 'idle' && 
          instance.runningTasks === 0 &&
          now - instance.lastActivityAt.getTime() > this.config.idleTimeout * 1000) {
        this.logger.info(`Instance ${instance.instanceId} idle timeout reached`)
        instance.state = 'draining'
      }
    }
  }

  private startAutoScaling(): void {
    this.scaleInterval = setInterval(async () => {
      await this.performAutoScaling()
    }, 30000) // Every 30 seconds
  }

  private async performAutoScaling(): Promise<void> {
    const totalCapacity = this.instances.size * this.config.maxTasksPerInstance
    const totalRunning = Array.from(this.instances.values())
      .reduce((sum, i) => sum + i.runningTasks, 0)
    
    const utilization = totalCapacity > 0 ? totalRunning / totalCapacity : 0
    
    this.logger.debug('Pool utilization', {
      utilization,
      totalRunning,
      totalCapacity,
      instances: this.instances.size,
    })
    
    // Scale up if needed
    if (utilization > this.config.scaleUpThreshold && 
        this.instances.size < this.config.maxInstances) {
      await this.scaleUp(1)
    }
    
    // Scale down if needed
    if (utilization < this.config.scaleDownThreshold && 
        this.instances.size > this.config.minInstances) {
      await this.scaleDown(1)
    }
  }

  private generateUserData(): string {
    return `#!/bin/bash
# Install Docker
yum update -y
yum install -y docker
service docker start
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Pull Claude Code image
docker pull anthropic/claude-code:latest

# Setup task isolation script
cat > /usr/local/bin/run-task.sh << 'EOF'
#!/bin/bash
TASK_ID=$1
USER_ID=$2
REPO_URL=$3

# Create isolated workspace
mkdir -p /workspace/$USER_ID/$TASK_ID

# Run task in container
docker run -d \\
  --name task-$TASK_ID \\
  --user $USER_ID:$USER_ID \\
  -v /workspace/$USER_ID/$TASK_ID:/workspace \\
  -e TASK_ID=$TASK_ID \\
  -e USER_ID=$USER_ID \\
  -e REPO_URL=$REPO_URL \\
  --cpus="1" \\
  --memory="2g" \\
  --network=isolated \\
  anthropic/claude-code:latest
EOF

chmod +x /usr/local/bin/run-task.sh

# Signal instance ready
aws ec2 create-tags --resources $(ec2-metadata --instance-id | cut -d' ' -f2) --tags Key=Status,Value=ready
`
  }

  getPoolStats(): {
    totalInstances: number
    idleInstances: number
    busyInstances: number
    totalTasks: number
    totalCapacity: number
    utilization: number
  } {
    const instances = Array.from(this.instances.values())
    const idleInstances = instances.filter(i => i.state === 'idle').length
    const busyInstances = instances.filter(i => i.state === 'busy').length
    const totalTasks = instances.reduce((sum, i) => sum + i.runningTasks, 0)
    const totalCapacity = instances.length * this.config.maxTasksPerInstance
    const utilization = totalCapacity > 0 ? totalTasks / totalCapacity : 0
    
    return {
      totalInstances: instances.length,
      idleInstances,
      busyInstances,
      totalTasks,
      totalCapacity,
      utilization,
    }
  }
}