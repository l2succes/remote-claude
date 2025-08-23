import { spawn, ChildProcess, SpawnOptions } from 'child_process'
import { EventEmitter } from 'events'
import { Readable, Writable } from 'stream'

export interface ExecutionOptions extends SpawnOptions {
  timeout?: number
  maxBuffer?: number
}

export interface ExecutionResult {
  pid?: number
  stdout: Readable
  stderr: Readable
  stdin: Writable
  on(event: 'exit', listener: (code: number | null) => void): void
  on(event: 'error', listener: (error: Error) => void): void
  kill(): void
}

export class CommandExecutor {
  private processes: Map<number, ChildProcess> = new Map()
  
  async execute(
    command: string,
    args: string[] = [],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const childProcess = spawn(command, args, {
      ...options,
      shell: true
    })
    
    if (childProcess.pid) {
      this.processes.set(childProcess.pid, childProcess)
      
      // Clean up on exit
      childProcess.on('exit', () => {
        if (childProcess.pid) {
          this.processes.delete(childProcess.pid)
        }
      })
    }
    
    // Handle timeout
    if (options.timeout) {
      setTimeout(() => {
        childProcess.kill('SIGTERM')
      }, options.timeout)
    }
    
    return {
      pid: childProcess.pid,
      stdout: childProcess.stdout!,
      stderr: childProcess.stderr!,
      stdin: childProcess.stdin!,
      on: (event: string, listener: any) => childProcess.on(event, listener),
      kill: () => childProcess.kill()
    }
  }
  
  async executeSync(
    command: string,
    args: string[] = [],
    options: ExecutionOptions = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise(async (resolve, reject) => {
      const result = await this.execute(command, args, options)
      
      let stdout = ''
      let stderr = ''
      
      result.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      result.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      result.on('exit', (code) => {
        resolve({ stdout, stderr, exitCode: code })
      })
      
      result.on('error', (error) => {
        reject(error)
      })
    })
  }
  
  async kill(pid: number, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    const proc = this.processes.get(pid)
    if (proc) {
      proc.kill(signal)
      this.processes.delete(pid)
      return true
    }
    
    // Try to kill process even if not in our map
    try {
      process.kill(pid, signal)
      return true
    } catch {
      return false
    }
  }
  
  async killAll(): Promise<void> {
    for (const [pid, process] of this.processes) {
      process.kill()
    }
    this.processes.clear()
  }
  
  getActiveProcesses(): number[] {
    return Array.from(this.processes.keys())
  }
  
  async executeShell(script: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    return this.execute('sh', ['-c', script], options)
  }
  
  async executePython(script: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    return this.execute('python3', ['-c', script], options)
  }
  
  async executeNode(script: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    return this.execute('node', ['-e', script], options)
  }
}