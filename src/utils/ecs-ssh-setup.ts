import { ECSClient, RegisterTaskDefinitionCommand } from '@aws-sdk/client-ecs'
import { Config } from './config'
import { logger } from './logger'

export async function setupSSHTaskDefinition(): Promise<void> {
  const region = Config.get('aws.region') || 'us-east-1'
  const taskRoleArn = Config.get('aws.ecs.taskRoleArn')
  const executionRoleArn = Config.get('aws.ecs.executionRoleArn')
  
  const ecsClient = new ECSClient({ region })
  
  logger.info('Registering SSH task definition...')
  
  try {
    const response = await ecsClient.send(new RegisterTaskDefinitionCommand({
      family: 'remote-claude-ssh',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['EC2'],
      cpu: '1024',
      memory: '2048',
      taskRoleArn,
      executionRoleArn,
      containerDefinitions: [{
        name: 'ssh-container',
        image: Config.get('aws.ecs.sshImage') || 'public.ecr.aws/amazonlinux/amazonlinux:latest', // Fallback for testing
        essential: true,
        environment: [
          { name: 'CONTAINER_TYPE', value: 'SSH' }
        ],
        portMappings: [{
          containerPort: 22,
          protocol: 'tcp'
        }],
        linuxParameters: {
          initProcessEnabled: true
        },
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': '/ecs/remote-claude-ssh',
            'awslogs-region': region,
            'awslogs-stream-prefix': 'ssh',
            'awslogs-create-group': 'true'
          }
        }
      }]
    }))
    
    logger.info('SSH task definition registered', {
      family: response.taskDefinition?.family,
      revision: response.taskDefinition?.revision
    })
  } catch (error) {
    logger.error('Failed to register SSH task definition', { error })
    throw error
  }
}