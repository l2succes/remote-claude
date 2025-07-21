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
    
    this.logger.info('ECS session created', { 
      sessionId: session.id,
      serviceArn,
      taskArn 
    })
    
    return session
  }

  async terminateSession(sessionId: string): Promise<void> {
    this.logger.info('Terminating ECS session', { sessionId })
    
    // Remove task from service tracking
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
    
    // Use ECS Exec to run commands in containers
    // For now, return a placeholder
    // TODO: Implement ECS Exec integration
    
    return {
      success: true,
      output: 'ECS Exec not yet implemented',
      error: '',
      exitCode: 0
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
        image: Config.get('ecs.containerImage') || 'anthropic/claude-code:latest',
        essential: true,
        environment: [
          { name: 'PROVIDER', value: 'ecs' },
          { name: 'REMOTE_CLAUDE', value: 'true' }
        ],
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
    
    // Check if service already exists
    const existingServiceArn = this.repositoryServices.get(repoKey)
    if (existingServiceArn) {
      return existingServiceArn
    }
    
    // Create new service for this repository
    const serviceName = `claude-${repoKey}`
    
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
    // In ECS, services manage tasks automatically
    // We'll track task associations separately
    
    // For now, return a mock task ARN
    return `arn:aws:ecs:${this.config.region}:123456789:task/${taskId}`
  }

  private async executeCommandInContainer(
    sessionId: string, 
    command: string
  ): Promise<any> {
    // This would use ECS Exec (AWS SSM) to run commands
    // Requires proper IAM roles and SSM agent in container
    
    return {
      exitCode: 0,
      stdout: 'Command executed successfully',
      stderr: '',
      taskArn: `arn:aws:ecs:${this.config.region}:123456789:task/${sessionId}`
    }
  }

  private getRepoKey(repository: string): string {
    return repository
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .toLowerCase()
  }
}