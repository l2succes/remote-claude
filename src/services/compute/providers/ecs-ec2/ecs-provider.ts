import { 
  ECSClient, 
  CreateClusterCommand, 
  RegisterTaskDefinitionCommand,
  CreateServiceCommand,
  UpdateServiceCommand,
  DescribeServicesCommand,
  DescribeTasksCommand,
  RunTaskCommand,
  StopTaskCommand,
  ListTasksCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  TaskDefinition,
  Service,
  Task
} from '@aws-sdk/client-ecs'
import { 
  EC2Client,
  DescribeInstancesCommand,
  CreateLaunchTemplateCommand,
  RunInstancesCommand
} from '@aws-sdk/client-ec2'
import { 
  AutoScalingClient,
  CreateAutoScalingGroupCommand,
  UpdateAutoScalingGroupCommand
} from '@aws-sdk/client-auto-scaling'
import { ComputeProvider, ComputeSession, SessionOptions, TaskResult } from '../../types'
import { Logger } from '../../../../utils/logger'
import { Config } from '../../../../utils/config'
import { EventEmitter } from 'events'
import { AWSSetupHelper } from '../../../../utils/aws-setup-helper'

export interface ECSProviderConfig {
  clusterName: string
  region: string
  vpcId?: string
  subnetIds: string[]
  securityGroupIds: string[]
  instanceType: string
  minInstances: number
  maxInstances: number
  enableSpot: boolean
  spotMaxPrice?: string
  containerInsights: boolean
}

export class ECSProvider implements ComputeProvider {
  readonly name = 'aws'
  private logger = new Logger('ECSProvider')
  private ecsClient: ECSClient
  private ec2Client: EC2Client
  private autoScalingClient: AutoScalingClient
  private config: ECSProviderConfig
  private eventEmitter: EventEmitter
  private clusterArn?: string
  private taskDefinitionArn?: string
  private repositoryServices: Map<string, string> = new Map() // repo -> service ARN
  private sessionTaskMap: Map<string, string> = new Map() // sessionId -> taskArn

  constructor(config: ECSProviderConfig) {
    this.config = config
    const awsConfig: any = {
      region: config.region
    }
    
    // Only add credentials if they are explicitly provided and valid
    const accessKeyId = Config.get('aws.accessKeyId')
    const secretAccessKey = Config.get('aws.secretAccessKey')
    
    if (accessKeyId && secretAccessKey) {
      awsConfig.credentials = {
        accessKeyId,
        secretAccessKey
      }
    }
    // Otherwise, let AWS SDK use its default credential provider chain:
    // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. Shared credentials file (~/.aws/credentials)
    // 3. ECS/EC2 IAM roles
    // 4. etc.
    
    this.ecsClient = new ECSClient(awsConfig)
    this.ec2Client = new EC2Client(awsConfig)
    this.autoScalingClient = new AutoScalingClient(awsConfig)
    this.eventEmitter = new EventEmitter()
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ECS provider', { config: this.config })
    
    // Check AWS setup before proceeding
    const setupOk = await AWSSetupHelper.performFullSetupCheck({
      clusterName: this.config.clusterName,
      region: this.config.region
    })
    
    if (!setupOk) {
      // User needs to set up AWS first
      throw new Error('AWS_SETUP_REQUIRED')
    }
    
    // Create or verify ECS cluster
    await this.ensureCluster()
    
    // Create task definition
    await this.createTaskDefinition()
    
    // Skip EC2 capacity setup - CloudFormation handles this
    // await this.setupEC2Capacity()
    
    this.logger.info('ECS provider initialized successfully')
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ECS provider')
    
    // Stop all running services
    for (const [repo, serviceArn] of this.repositoryServices) {
      try {
        await this.ecsClient.send(new UpdateServiceCommand({
          cluster: this.clusterArn,
          service: serviceArn,
          desiredCount: 0
        }))
      } catch (error) {
        this.logger.error('Failed to stop service', { repo, error })
      }
    }
    
    // Note: We don't delete the cluster as it might be shared
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
    this.logger.info('Creating ECS session', { options })
    
    if (!options.repository) {
      throw new Error('Repository is required for ECS sessions')
    }
    
    // Get or create service for this repository
    const serviceArn = await this.getOrCreateService(options.repository, options.branch)
    
    // Add task to service (by adding metadata)
    const taskArn = await this.addTaskToService(serviceArn, options.taskId)
    
    const session: ComputeSession = {
      id: options.taskId,
      provider: this.name,
      status: 'active',
      createdAt: new Date(),
      metadata: {
        clusterArn: this.clusterArn,
        serviceArn,
        taskArn,
        repository: options.repository,
        branch: options.branch,
        userId: options.userId,
      }
    }
    
    // Store the session-to-task mapping
    // In a real implementation, this would be persisted
    this.sessionTaskMap.set(options.taskId, taskArn)
    
    this.logger.info('ECS session created', { 
      sessionId: session.id,
      serviceArn,
      taskArn 
    })
    
    return session
  }

  async terminateSession(sessionId: string): Promise<void> {
    this.logger.info('Terminating ECS session', { sessionId })
    
    // Get the task ARN
    const taskArn = this.sessionTaskMap.get(sessionId)
    if (taskArn) {
      try {
        // Stop the ECS task
        await this.ecsClient.send(new StopTaskCommand({
          cluster: this.clusterArn,
          task: taskArn,
          reason: `Session ${sessionId} terminated`
        }))
        
        this.logger.info('Stopped ECS task', { taskArn, sessionId })
      } catch (error) {
        this.logger.error('Failed to stop task', { error, taskArn, sessionId })
      }
      
      // Remove from our map
      this.sessionTaskMap.delete(sessionId)
    }
    
    // Service continues running for other tasks
    
    this.eventEmitter.emit('session:terminated', { sessionId })
  }

  async getSessionStatus(sessionId: string): Promise<ComputeSession> {
    // Check task status in ECS
    try {
      const tasks = await this.ecsClient.send(new ListTasksCommand({
        cluster: this.clusterArn,
        // Filter by task tag or metadata
      }))
      
      const status = (tasks.taskArns?.length ?? 0) > 0 ? 'active' : 'terminated'
      
      return {
        id: sessionId,
        provider: this.name,
        status: status as any,
        metadata: {
          clusterArn: this.clusterArn
        }
      }
    } catch (error) {
      return {
        id: sessionId,
        provider: this.name,
        status: 'error',
        metadata: {
          error: (error as Error).message
        }
      }
    }
  }

  async executeCommand(sessionId: string, command: string): Promise<TaskResult> {
    this.logger.info('Executing command in ECS session', { sessionId, command })
    
    try {
      const result = await this.executeCommandInContainer(sessionId, command)
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode
      }
    } catch (error) {
      this.logger.error('Command execution failed', { error, sessionId })
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1
      }
    }
  }

  async listSessions(userId?: string): Promise<ComputeSession[]> {
    const sessions: ComputeSession[] = []
    
    try {
      // List all services in the cluster
      const services = await this.ecsClient.send(new ListServicesCommand({
        cluster: this.clusterArn
      }))
      
      if (services.serviceArns) {
        // Get tasks for each service
        for (const serviceArn of services.serviceArns) {
          const tasks = await this.ecsClient.send(new ListTasksCommand({
            cluster: this.clusterArn,
            serviceName: serviceArn
          }))
          
          if (tasks.taskArns) {
            for (const taskArn of tasks.taskArns) {
              // Extract task ID from ARN
              const taskId = taskArn.split('/').pop() || ''
              
              sessions.push({
                id: taskId,
                provider: this.name,
                status: 'active',
                metadata: {
                  serviceArn,
                  taskArn,
                  clusterArn: this.clusterArn
                }
              })
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to list sessions', { error })
    }
    
    return sessions
  }

  // Private methods

  private async ensureCluster(): Promise<void> {
    try {
      const response = await this.ecsClient.send(new DescribeClustersCommand({
        clusters: [this.config.clusterName]
      }))
      
      if (response.clusters && response.clusters.length > 0) {
        this.clusterArn = response.clusters[0]?.clusterArn || ''
        this.logger.info('Using existing cluster', { clusterArn: this.clusterArn })
      } else {
        throw new Error('Cluster not found')
      }
    } catch (error) {
      // Create new cluster
      const createResponse = await this.ecsClient.send(new CreateClusterCommand({
        clusterName: this.config.clusterName,
        settings: this.config.containerInsights ? [{
          name: 'containerInsights',
          value: 'enabled'
        }] : [],
        capacityProviders: ['FARGATE', 'FARGATE_SPOT'],
      }))
      
      this.clusterArn = createResponse.cluster?.clusterArn!
      this.logger.info('Created new cluster', { clusterArn: this.clusterArn })
    }
  }

  private async createTaskDefinition(): Promise<void> {
    const taskDef = {
      family: 'remote-claude-task',
      networkMode: 'awsvpc' as any, // AWS SDK type issue
      requiresCompatibilities: ['EC2'] as any, // AWS SDK type issue
      cpu: '1024',
      memory: '2048',
      containerDefinitions: [{
        name: 'claude-code',
        image: Config.get('ecs.containerImage') || 'node:20-slim',
        essential: true,
        environment: [
          { name: 'PROVIDER', value: 'ecs' },
          { name: 'REMOTE_CLAUDE', value: 'true' },
          { name: 'CLAUDE_AUTO_START', value: 'true' }
        ],
        command: ['/bin/bash', '-c', `
          # Install Claude Code if not present
          if ! command -v claude &> /dev/null; then
            npm install -g @anthropic-ai/claude-code
          fi
          
          # Create startup script
          cat > /usr/local/bin/claude-start.sh << 'EOF'
#!/bin/bash
echo "🚀 Welcome to Remote Claude ECS Container!"
echo "===================================="
echo ""
echo "Claude Code will start automatically..."
echo ""

# Start Claude Code
exec claude
EOF
          
          chmod +x /usr/local/bin/claude-start.sh
          
          # Keep container running and start Claude Code on connection
          while true; do
            sleep infinity
          done
        `],
        portMappings: [{
          containerPort: 8080,
          protocol: 'tcp' as any // AWS SDK type issue
        }],
        logConfiguration: {
          logDriver: 'awslogs' as any, // AWS SDK type issue
          options: {
            'awslogs-group': `/ecs/${this.config.clusterName}`,
            'awslogs-region': this.config.region,
            'awslogs-stream-prefix': 'claude-code'
          }
        },
        // Removed mountPoints for now - would need EFS setup
        linuxParameters: {
          initProcessEnabled: true
        }
      }],
      // Removed volumes for now - would need EFS setup
      executionRoleArn: Config.get('aws.ecs.executionRoleArn') || Config.get('ecs.executionRoleArn'),
      taskRoleArn: Config.get('aws.ecs.taskRoleArn') || Config.get('ecs.taskRoleArn'),
    }
    
    const response = await this.ecsClient.send(new RegisterTaskDefinitionCommand(taskDef))
    this.taskDefinitionArn = response.taskDefinition?.taskDefinitionArn!
    
    this.logger.info('Task definition created', { 
      taskDefinitionArn: this.taskDefinitionArn 
    })
  }

  private async setupEC2Capacity(): Promise<void> {
    // Create launch template for EC2 instances
    const launchTemplate = await this.createLaunchTemplate()
    
    // Create auto-scaling group
    await this.createAutoScalingGroup(launchTemplate.LaunchTemplateId!)
    
    this.logger.info('EC2 capacity provider configured')
  }

  private async createLaunchTemplate() {
    const userData = Buffer.from(`#!/bin/bash
echo ECS_CLUSTER=${this.config.clusterName} >> /etc/ecs/ecs.config
echo ECS_ENABLE_TASK_IAM_ROLE=true >> /etc/ecs/ecs.config
echo ECS_ENABLE_SPOT_INSTANCE_DRAINING=true >> /etc/ecs/ecs.config
echo ECS_CONTAINER_START_TIMEOUT=15m >> /etc/ecs/ecs.config
echo ECS_ENABLE_CONTAINER_METADATA=true >> /etc/ecs/ecs.config

# Install ECS Exec dependencies
yum install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
`).toString('base64')
    
    const response = await this.ec2Client.send(new CreateLaunchTemplateCommand({
      LaunchTemplateName: `${this.config.clusterName}-template`,
      LaunchTemplateData: {
        ImageId: Config.get('ecs.amiId') || 'ami-0c02fb55956c7d316', // ECS-optimized AMI
        InstanceType: this.config.instanceType as any, // AWS SDK type issue
        IamInstanceProfile: {
          Arn: Config.get('ecs.instanceProfileArn')
        },
        SecurityGroupIds: this.config.securityGroupIds,
        UserData: userData,
        TagSpecifications: [{
          ResourceType: 'instance',
          Tags: [
            { Key: 'Name', Value: `${this.config.clusterName}-instance` },
            { Key: 'Provider', Value: 'remote-claude' }
          ]
        }],
        BlockDeviceMappings: [{
          DeviceName: '/dev/xvda',
          Ebs: {
            VolumeSize: 30,
            VolumeType: 'gp3',
            DeleteOnTermination: true
          }
        }]
      }
    }))
    
    return response.LaunchTemplate!
  }

  private async createAutoScalingGroup(launchTemplateId: string): Promise<void> {
    await this.autoScalingClient.send(new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: `${this.config.clusterName}-asg`,
      LaunchTemplate: {
        LaunchTemplateId: launchTemplateId,
        Version: '$Latest'
      },
      MinSize: this.config.minInstances,
      MaxSize: this.config.maxInstances,
      DesiredCapacity: this.config.minInstances,
      VPCZoneIdentifier: this.config.subnetIds.join(','),
      HealthCheckType: 'ECS',
      HealthCheckGracePeriod: 300,
      NewInstancesProtectedFromScaleIn: false,
      CapacityRebalance: true,
      MixedInstancesPolicy: this.config.enableSpot ? {
        InstancesDistribution: {
          OnDemandPercentageAboveBaseCapacity: 20,
          SpotAllocationStrategy: 'capacity-optimized',
          SpotMaxPrice: this.config.spotMaxPrice || '',
        },
        LaunchTemplate: {
          LaunchTemplateSpecification: {
            LaunchTemplateId: launchTemplateId,
            Version: '$Latest'
          },
          Overrides: [
            { InstanceType: this.config.instanceType },
            { InstanceType: 't3.large' },
            { InstanceType: 't3a.large' },
          ]
        }
      } : undefined,
      Tags: [
        {
          Key: 'Name',
          Value: `${this.config.clusterName}-asg`,
          PropagateAtLaunch: true
        }
      ]
    }))
  }

  private async getOrCreateService(repository: string, branch?: string): Promise<string> {
    const repoKey = this.getRepoKey(repository)
    
    // Check if service already exists in our map
    const existingServiceArn = this.repositoryServices.get(repoKey)
    if (existingServiceArn) {
      return existingServiceArn
    }
    
    // Check if service exists in ECS
    const serviceName = `claude-${repoKey}`
    try {
      const describeResponse = await this.ecsClient.send(new DescribeServicesCommand({
        cluster: this.clusterArn,
        services: [serviceName]
      }))
      
      if (describeResponse.services && describeResponse.services.length > 0) {
        const service = describeResponse.services[0]
        if (service && service.status === 'ACTIVE' && service.serviceArn) {
          // Service exists, cache it and return
          this.repositoryServices.set(repoKey, service.serviceArn)
          this.logger.info('Using existing ECS service', { 
            repository, 
            serviceArn: service.serviceArn 
          })
          return service.serviceArn
        }
      }
    } catch (error) {
      // Service doesn't exist, continue to create it
      this.logger.debug('Service not found, will create new one', { serviceName })
    }
    
    // Create new service for this repository
    const response = await this.ecsClient.send(new CreateServiceCommand({
      cluster: this.clusterArn,
      serviceName,
      taskDefinition: this.taskDefinitionArn,
      desiredCount: 1,
      launchType: 'EC2',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.config.subnetIds,
          securityGroups: this.config.securityGroupIds,
          // assignPublicIp not supported for EC2 launch type
        }
      },
      placementStrategy: [
        { type: 'spread', field: 'instanceId' },
        { type: 'binpack', field: 'memory' }
      ],
      enableExecuteCommand: true,
      propagateTags: 'SERVICE',
      tags: [
        { key: 'Repository', value: repository },
        { key: 'Branch', value: branch || 'main' }
      ]
    }))
    
    const serviceArn = response.service?.serviceArn!
    this.repositoryServices.set(repoKey, serviceArn)
    
    this.logger.info('Created ECS service for repository', { 
      repository, 
      serviceArn 
    })
    
    return serviceArn
  }

  private async addTaskToService(serviceArn: string, taskId: string): Promise<string> {
    // Run a new task in the service's cluster
    const runTaskResponse = await this.ecsClient.send(new RunTaskCommand({
      cluster: this.clusterArn!,
      taskDefinition: this.taskDefinitionArn!,
      launchType: 'EC2',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.config.subnetIds,
          securityGroups: this.config.securityGroupIds,
        }
      },
      overrides: {
        containerOverrides: [{
          name: 'claude-code',
          environment: [
            { name: 'TASK_ID', value: taskId },
            { name: 'SERVICE_ARN', value: serviceArn }
          ]
        }]
      },
      enableExecuteCommand: true, // Enable ECS Exec
      propagateTags: 'TASK_DEFINITION',
      tags: [
        { key: 'TaskId', value: taskId },
        { key: 'ServiceArn', value: serviceArn }
      ]
    }))
    
    if (!runTaskResponse.tasks || runTaskResponse.tasks.length === 0) {
      throw new Error('Failed to run ECS task')
    }
    
    const taskArn = runTaskResponse.tasks[0]!.taskArn!
    this.logger.info('Started ECS task', { taskArn, taskId })
    
    // Wait for task to be running
    await this.waitForTaskRunning(taskArn)
    
    return taskArn
  }

  private async waitForTaskRunning(taskArn: string): Promise<void> {
    const maxAttempts = 30 // 30 * 2 seconds = 1 minute
    let attempts = 0
    
    while (attempts < maxAttempts) {
      const response = await this.ecsClient.send(new DescribeTasksCommand({
        cluster: this.clusterArn!,
        tasks: [taskArn]
      }))
      
      if (response.tasks && response.tasks.length > 0) {
        const task = response.tasks[0]
        if (task && task.lastStatus === 'RUNNING') {
          this.logger.info('Task is running', { taskArn })
          return
        } else if (task && task.lastStatus === 'STOPPED') {
          const reason = task.stoppedReason || 'Unknown reason'
          throw new Error(`Task stopped: ${reason}`)
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++
    }
    
    throw new Error('Timeout waiting for task to start')
  }
  
  private async executeCommandInContainer(
    sessionId: string, 
    command: string
  ): Promise<any> {
    // Get the task ARN for this session
    const taskArn = await this.getTaskArnForSession(sessionId)
    
    if (!taskArn) {
      throw new Error(`No task found for session ${sessionId}`)
    }
    
    // Import ECS Exec functionality
    const { executeECSCommand } = await import('./ecs-exec')
    
    try {
      const result = await executeECSCommand(this.ecsClient, {
        cluster: this.clusterArn!,
        task: taskArn,
        container: 'claude-code',
        command,
        interactive: false
      })
      
      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        taskArn
      }
    } catch (error) {
      this.logger.error('Failed to execute command', { error, sessionId, command })
      throw error
    }
  }
  
  private async getTaskArnForSession(sessionId: string): Promise<string | null> {
    // First check our in-memory map
    const cachedArn = this.sessionTaskMap.get(sessionId)
    if (cachedArn) {
      return cachedArn
    }
    
    // Otherwise, try to find a task with the matching tag
    const response = await this.ecsClient.send(new ListTasksCommand({
      cluster: this.clusterArn,
      desiredStatus: 'RUNNING'
    }))
    
    if (!response.taskArns || response.taskArns.length === 0) {
      return null
    }
    
    // Get task details to find the one with our session ID
    const tasks = await this.ecsClient.send(new DescribeTasksCommand({
      cluster: this.clusterArn,
      tasks: response.taskArns,
      include: ['TAGS']
    }))
    
    for (const task of tasks.tasks || []) {
      const taskIdTag = task.tags?.find(tag => tag.key === 'TaskId')
      if (taskIdTag?.value === sessionId) {
        const taskArn = task.taskArn || null
        if (taskArn) {
          // Cache it for future use
          this.sessionTaskMap.set(sessionId, taskArn)
        }
        return taskArn
      }
    }
    
    return null
  }

  private getRepoKey(repository: string): string {
    return repository
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .toLowerCase()
  }
}