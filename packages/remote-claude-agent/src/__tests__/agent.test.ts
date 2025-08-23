import { RemoteClaudeAgent } from '../agent'
import { RemoteClaudeClient } from '../client'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

describe('RemoteClaudeAgent', () => {
  let agent: RemoteClaudeAgent
  let client: RemoteClaudeClient
  let testDir: string
  const TEST_PORT = 9999
  
  beforeAll(async () => {
    // Create temp directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-'))
    
    // Start agent
    agent = new RemoteClaudeAgent({
      port: TEST_PORT,
      host: 'localhost',
      workDir: testDir
    })
    
    await agent.start()
    
    // Connect client
    client = new RemoteClaudeClient({
      url: `ws://localhost:${TEST_PORT}`
    })
    
    await client.connect()
  })
  
  afterAll(async () => {
    // Cleanup
    client.disconnect()
    await agent.stop()
    await fs.rmdir(testDir, { recursive: true })
  })
  
  describe('File System Operations', () => {
    test('should write and read a file', async () => {
      const testFile = 'test.txt'
      const content = 'Hello, World!'
      
      await client.writeFile(testFile, content)
      const readContent = await client.readFile(testFile)
      
      expect(readContent).toBe(content)
    })
    
    test('should list files in directory', async () => {
      // Create some test files
      await client.writeFile('file1.txt', 'content1')
      await client.writeFile('file2.txt', 'content2')
      await client.writeFile('subdir/file3.txt', 'content3')
      
      const files = await client.listFiles('.')
      
      expect(files).toContainEqual(
        expect.objectContaining({ name: 'file1.txt' })
      )
      expect(files).toContainEqual(
        expect.objectContaining({ name: 'file2.txt' })
      )
    })
    
    test('should delete a file', async () => {
      const testFile = 'to-delete.txt'
      
      await client.writeFile(testFile, 'delete me')
      await client.deleteFile(testFile)
      
      await expect(client.readFile(testFile)).rejects.toThrow()
    })
    
    test('should watch for file changes', (done) => {
      const testFile = 'watch-test.txt'
      
      const unwatch = client.watchFile('.', (event) => {
        if (event.filename === testFile && event.event === 'add') {
          unwatch()
          done()
        }
      })
      
      // Trigger file change
      setTimeout(() => {
        client.writeFile(testFile, 'trigger watch')
      }, 100)
    })
  })
  
  describe('Command Execution', () => {
    test('should execute a simple command', async () => {
      const exitCode = await client.executeCommand('echo', ['Hello'])
      expect(exitCode).toBe(0)
    })
    
    test('should handle command failure', async () => {
      const exitCode = await client.executeCommand('false')
      expect(exitCode).not.toBe(0)
    })
    
    test('should kill a running process', async () => {
      // Start a long-running process
      const processPromise = client.executeCommand('sleep', ['10'])
      
      // Wait a bit then kill it
      setTimeout(async () => {
        const response = await client.request('command:execute', {
          command: 'sleep',
          args: ['10']
        })
        
        const success = await client.killProcess(response.payload.pid)
        expect(success).toBe(true)
      }, 100)
      
      const exitCode = await processPromise
      expect(exitCode).not.toBe(0)
    })
  })
  
  describe('Health and Info', () => {
    test('should provide health status', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/health`)
      const health = await response.json()
      
      expect(health.status).toBe('healthy')
      expect(health.connections).toBeGreaterThanOrEqual(1)
      expect(health.workDir).toBe(testDir)
    })
    
    test('should provide agent info', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/info`)
      const info = await response.json()
      
      expect(info.version).toBe('0.1.0')
      expect(info.capabilities).toContain('file-system')
      expect(info.capabilities).toContain('command-execution')
    })
  })
  
  describe('Connection Management', () => {
    test('should handle reconnection', async () => {
      const reconnectClient = new RemoteClaudeClient({
        url: `ws://localhost:${TEST_PORT}`,
        reconnect: true,
        reconnectInterval: 100
      })
      
      await reconnectClient.connect()
      
      // Simulate disconnect
      reconnectClient['ws']?.close()
      
      await new Promise(resolve => {
        reconnectClient.on('connected', resolve)
      })
      
      expect(reconnectClient.isConnected).toBe(true)
      reconnectClient.disconnect()
    })
    
    test('should queue messages when disconnected', async () => {
      const queueClient = new RemoteClaudeClient({
        url: `ws://localhost:${TEST_PORT}`,
        reconnect: false
      })
      
      // Send message before connecting
      queueClient.send({ type: 'ping' })
      
      await queueClient.connect()
      
      await new Promise(resolve => {
        queueClient.on('pong', resolve)
      })
      
      queueClient.disconnect()
    })
  })
})