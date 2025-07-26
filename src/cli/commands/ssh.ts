import { Command } from 'commander'
import chalk from 'chalk'
import { logger } from '../../utils/logger'
import { Config } from '../../utils/config'
import { 
  ECSClient, 
  RunTaskCommand, 
  DescribeTasksCommand, 
  StopTaskCommand, 
  ListTasksCommand,
  RegisterTaskDefinitionCommand 
} from '@aws-sdk/client-ecs'
import { EC2Client, DescribeNetworkInterfacesCommand } from '@aws-sdk/client-ec2'
import { spawn } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { randomBytes } from 'crypto'

interface SSHTask {
  taskId: string
  taskArn: string
  publicIp?: string
  privateKeyPath: string
  status: string
  createdAt: Date
}

export function createSSHCommand() {
  const program = new Command('ssh')
    .description('Manage SSH-enabled containers')

  program
    .command('create')
    .description('Create a new SSH-enabled container')
    .option('-n, --name <name>', 'Name for the container')
    .option('-t, --type <type>', 'Instance type', 't3.medium')
    .action(async (options) => {
      try {
        await createSSHContainer(options)
      } catch (error) {
        logger.error('Failed to create SSH container', { error })
        process.exit(1)
      }
    })

  program
    .command('list')
    .description('List active SSH containers')
    .action(async () => {
      try {
        await listSSHContainers()
      } catch (error) {
        logger.error('Failed to list SSH containers', { error })
        process.exit(1)
      }
    })

  program
    .command('connect <taskId>')
    .description('Connect to an SSH container')
    .action(async (taskId) => {
      try {
        await connectSSHContainer(taskId)
      } catch (error) {
        logger.error('Failed to connect to SSH container', { error })
        process.exit(1)
      }
    })

  program
    .command('stop <taskId>')
    .description('Stop an SSH container')
    .action(async (taskId) => {
      try {
        await stopSSHContainer(taskId)
      } catch (error) {
        logger.error('Failed to stop SSH container', { error })
        process.exit(1)
      }
    })

  return program
}

async function createSSHContainer(options: any) {
  console.log(chalk.blue('Creating SSH-enabled container...'))
  
  // Generate SSH key pair
  const keyName = `rclaude-ssh-${Date.now()}`
  const { publicKey, privateKeyPath } = await generateSSHKeyPair(keyName)
  
  // Get AWS configuration
  const region = Config.get('aws.region') || 'us-east-1'
  const clusterName = Config.get('aws.ecs.clusterName') || 'remote-claude-cluster'
  const subnets = Config.get('aws.ecs.subnets') || []
  const securityGroups = Config.get('aws.ecs.securityGroups') || []
  
  const ecsClient = new ECSClient({ region })
  
  // Register or update task definition
  const taskDefinitionArn = await ensureTaskDefinition(ecsClient, region, publicKey)
  
  // Run the task
  const runTaskResponse = await ecsClient.send(new RunTaskCommand({
    cluster: clusterName,
    taskDefinition: 'remote-claude-ssh',
    launchType: 'EC2',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets,
        securityGroups,
        assignPublicIp: 'ENABLED'
      }
    }
  }))
  
  if (!runTaskResponse.tasks || runTaskResponse.tasks.length === 0) {
    throw new Error('Failed to create task')
  }
  
  const task = runTaskResponse.tasks[0]
  const taskId = task.taskArn!.split('/').pop()!
  
  console.log(chalk.green(`✓ Container created: ${taskId}`))
  console.log(chalk.gray('Waiting for container to start...'))
  
  // Wait for task to be running and get public IP
  const publicIp = await waitForTaskRunning(ecsClient, clusterName, task.taskArn!)
  
  // Save task information
  await saveSSHTask({
    taskId,
    taskArn: task.taskArn!,
    publicIp,
    privateKeyPath,
    status: 'running',
    createdAt: new Date()
  })
  
  console.log(chalk.green('\n✓ SSH container is ready!'))
  console.log(chalk.blue(`\nTo connect:`))
  console.log(chalk.white(`  rclaude ssh connect ${taskId}`))
  console.log(chalk.gray(`  or`))
  console.log(chalk.white(`  ssh -i ${privateKeyPath} claude@${publicIp}`))
}

async function listSSHContainers() {
  const tasks = await loadSSHTasks()
  
  if (tasks.length === 0) {
    console.log(chalk.yellow('No active SSH containers found'))
    return
  }
  
  console.log(chalk.blue('Active SSH Containers:\n'))
  console.log(chalk.gray('ID                  Status    Public IP         Created'))
  console.log(chalk.gray('─'.repeat(70)))
  
  for (const task of tasks) {
    const age = getAge(task.createdAt)
    console.log(
      `${task.taskId.padEnd(20)} ${task.status.padEnd(10)} ${(task.publicIp || 'N/A').padEnd(17)} ${age}`
    )
  }
}

async function connectSSHContainer(taskId: string) {
  const task = await loadSSHTask(taskId)
  
  if (!task) {
    console.log(chalk.red(`Container ${taskId} not found`))
    return
  }
  
  if (!task.publicIp) {
    console.log(chalk.red('Container does not have a public IP'))
    return
  }
  
  console.log(chalk.blue(`Connecting to ${taskId}...`))
  
  // Spawn SSH process
  const ssh = spawn('ssh', [
    '-i', task.privateKeyPath,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    `claude@${task.publicIp}`
  ], {
    stdio: 'inherit'
  })
  
  ssh.on('exit', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`\nSSH exited with code ${code}`))
    }
  })
}

async function stopSSHContainer(taskId: string) {
  const task = await loadSSHTask(taskId)
  
  if (!task) {
    console.log(chalk.red(`Container ${taskId} not found`))
    return
  }
  
  console.log(chalk.blue(`Stopping container ${taskId}...`))
  
  const region = Config.get('aws.region') || 'us-east-1'
  const clusterName = Config.get('aws.ecs.clusterName') || 'remote-claude-cluster'
  const ecsClient = new ECSClient({ region })
  
  await ecsClient.send(new StopTaskCommand({
    cluster: clusterName,
    task: task.taskArn,
    reason: 'User requested stop'
  }))
  
  // Remove from saved tasks
  await removeSSHTask(taskId)
  
  // Clean up SSH key
  try {
    await fs.unlink(task.privateKeyPath)
    await fs.unlink(`${task.privateKeyPath}.pub`)
  } catch (error) {
    // Ignore if files don't exist
  }
  
  console.log(chalk.green(`✓ Container ${taskId} stopped`))
}

// Helper functions

async function generateSSHKeyPair(keyName: string): Promise<{ publicKey: string, privateKeyPath: string }> {
  const sshDir = path.join(os.homedir(), '.rclaude', 'ssh')
  await fs.mkdir(sshDir, { recursive: true })
  
  const privateKeyPath = path.join(sshDir, keyName)
  const publicKeyPath = `${privateKeyPath}.pub`
  
  // Generate key pair using ssh-keygen
  return new Promise((resolve, reject) => {
    const keygen = spawn('ssh-keygen', [
      '-t', 'rsa',
      '-b', '4096',
      '-f', privateKeyPath,
      '-N', '', // No passphrase
      '-C', 'rclaude-ssh'
    ])
    
    keygen.on('exit', async (code) => {
      if (code !== 0) {
        reject(new Error(`ssh-keygen failed with code ${code}`))
        return
      }
      
      const publicKey = await fs.readFile(publicKeyPath, 'utf-8')
      
      // Set proper permissions
      await fs.chmod(privateKeyPath, 0o600)
      
      resolve({ publicKey: publicKey.trim(), privateKeyPath })
    })
  })
}

async function waitForTaskRunning(
  ecsClient: ECSClient, 
  clusterName: string, 
  taskArn: string
): Promise<string> {
  const maxAttempts = 30
  let attempts = 0
  
  while (attempts < maxAttempts) {
    const describeResponse = await ecsClient.send(new DescribeTasksCommand({
      cluster: clusterName,
      tasks: [taskArn]
    }))
    
    if (!describeResponse.tasks || describeResponse.tasks.length === 0) {
      throw new Error('Task not found')
    }
    
    const task = describeResponse.tasks[0]
    
    if (task.lastStatus === 'RUNNING') {
      // Get public IP from network interface
      const attachment = task.attachments?.find(a => a.type === 'ElasticNetworkInterface')
      if (attachment) {
        const eniId = attachment.details?.find(d => d.name === 'networkInterfaceId')?.value
        if (eniId) {
          const ec2Client = new EC2Client({ 
            region: ecsClient.config.region || Config.get('aws.region') || 'us-east-1' 
          })
          
          const eniResponse = await ec2Client.send(new DescribeNetworkInterfacesCommand({
            NetworkInterfaceIds: [eniId]
          }))
          
          const publicIp = eniResponse.NetworkInterfaces?.[0]?.Association?.PublicIp
          if (publicIp) {
            return publicIp
          }
        }
      }
    }
    
    if (task.lastStatus === 'STOPPED') {
      throw new Error(`Task stopped: ${task.stoppedReason}`)
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    attempts++
  }
  
  throw new Error('Timeout waiting for task to start')
}

async function saveSSHTask(task: SSHTask): Promise<void> {
  const tasksFile = path.join(os.homedir(), '.rclaude', 'ssh-tasks.json')
  
  let tasks: SSHTask[] = []
  try {
    const data = await fs.readFile(tasksFile, 'utf-8')
    tasks = JSON.parse(data)
  } catch (error) {
    // File doesn't exist yet
  }
  
  tasks.push(task)
  
  await fs.mkdir(path.dirname(tasksFile), { recursive: true })
  await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2))
}

async function loadSSHTasks(): Promise<SSHTask[]> {
  const tasksFile = path.join(os.homedir(), '.rclaude', 'ssh-tasks.json')
  
  try {
    const data = await fs.readFile(tasksFile, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function loadSSHTask(taskId: string): Promise<SSHTask | undefined> {
  const tasks = await loadSSHTasks()
  return tasks.find(t => t.taskId === taskId)
}

async function removeSSHTask(taskId: string): Promise<void> {
  const tasksFile = path.join(os.homedir(), '.rclaude', 'ssh-tasks.json')
  const tasks = await loadSSHTasks()
  const filtered = tasks.filter(t => t.taskId !== taskId)
  await fs.writeFile(tasksFile, JSON.stringify(filtered, null, 2))
}

function getAge(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return `${minutes}m ago`
}

async function ensureTaskDefinition(
  ecsClient: ECSClient,
  region: string,
  publicKey: string
): Promise<string> {
  const taskRoleArn = Config.get('aws.ecs.taskRoleArn')
  const executionRoleArn = Config.get('aws.ecs.executionRoleArn')
  const sshImage = Config.get('aws.ecs.sshImage') || 'public.ecr.aws/amazonlinux/amazonlinux:latest'
  
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
        image: sshImage,
        essential: true,
        environment: [
          { name: 'SSH_PUBLIC_KEY', value: publicKey }
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
    
    return response.taskDefinition?.taskDefinitionArn || 'remote-claude-ssh'
  } catch (error) {
    logger.warn('Failed to register task definition, using existing', { error })
    return 'remote-claude-ssh'
  }
}