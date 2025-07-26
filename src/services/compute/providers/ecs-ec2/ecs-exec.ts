import { ECSClient, ExecuteCommandCommand } from '@aws-sdk/client-ecs'
import { spawn } from 'child_process'
import { Logger } from '../../../../utils/logger'

const logger = new Logger('ecs-exec')

export interface ECSExecOptions {
  cluster: string
  task: string
  container?: string
  command?: string
  interactive?: boolean
}

/**
 * Execute a command in an ECS container using ECS Exec
 */
export async function executeECSCommand(
  ecsClient: ECSClient,
  options: ECSExecOptions
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { cluster, task, container = 'claude-code', command = '/bin/bash', interactive = false } = options
  
  try {
    // Get session token for ECS Exec
    const response = await ecsClient.send(new ExecuteCommandCommand({
      cluster,
      task,
      container,
      command,
      interactive
    }))
    
    if (!response.session) {
      throw new Error('Failed to create ECS Exec session')
    }
    
    // For interactive sessions, we need to use the session-manager-plugin
    if (interactive) {
      return await runInteractiveSession(response.session)
    } else {
      // For non-interactive, we can collect output
      return await runNonInteractiveCommand(response.session, command)
    }
  } catch (error) {
    logger.error('ECS Exec failed', { error, options })
    throw error
  }
}

/**
 * Run an interactive ECS Exec session using session-manager-plugin
 */
async function runInteractiveSession(session: any): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // The session response contains the WebSocket URL and token
    // We need to use the session-manager-plugin to connect
    const sessionJson = JSON.stringify({
      SessionId: session.sessionId,
      TokenValue: session.tokenValue,
      StreamUrl: session.streamUrl
    })
    
    // Spawn session-manager-plugin
    const smp = spawn('session-manager-plugin', [
      sessionJson,
      'us-east-1', // This should come from config
      'StartSession',
      '',
      JSON.stringify({
        Target: session.sessionId
      }),
      'https://ecs.us-east-1.amazonaws.com'
    ], {
      stdio: 'inherit',
      env: process.env
    })
    
    smp.on('exit', (code) => {
      resolve({
        exitCode: code || 0,
        stdout: '',
        stderr: ''
      })
    })
    
    smp.on('error', (error) => {
      logger.error('session-manager-plugin error', { error })
      reject(error)
    })
  })
}

/**
 * Run a non-interactive command and collect output
 */
async function runNonInteractiveCommand(
  session: any,
  command: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  // For non-interactive commands, we would need to implement
  // WebSocket communication to collect output
  // This is a placeholder for now
  logger.warn('Non-interactive ECS Exec not fully implemented')
  
  return {
    exitCode: 0,
    stdout: `Would execute: ${command}`,
    stderr: ''
  }
}

/**
 * Check if session-manager-plugin is installed
 */
export async function checkSessionManagerPlugin(): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('which', ['session-manager-plugin'])
    check.on('exit', (code) => {
      resolve(code === 0)
    })
    check.on('error', () => {
      resolve(false)
    })
  })
}