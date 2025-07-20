/**
 * Tests for EC2Provider
 */

import { EC2Provider } from '../ec2-provider'
import { 
  EC2Config, 
  EnvironmentStatus, 
  TaskStatus, 
  ValidationResult,
  ComputeProviderType 
} from '../../types'

// Mock AWS SDK
jest.mock('@aws-sdk/client-ec2')
jest.mock('@aws-sdk/client-ssm')
jest.mock('ssh2')

describe('EC2Provider', () => {
  let provider: EC2Provider
  let mockConfig: EC2Config

  beforeEach(() => {
    mockConfig = {
      region: 'us-east-1',
      instanceType: 't3.medium',
      spotInstance: false,
      idleTimeout: 60,
      autoTerminate: true,
      tags: {
        Project: 'remote-claude'
      }
    }

    provider = new EC2Provider(mockConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Provider metadata', () => {
    test('should have correct name and type', () => {
      expect(provider.name).toBe('Amazon EC2')
      expect(provider.type).toBe(ComputeProviderType.EC2)
    })

    test('should return capabilities', () => {
      const capabilities = provider.getCapabilities()
      
      expect(capabilities.supportsSpotInstances).toBe(true)
      expect(capabilities.supportsPersistentStorage).toBe(true)
      expect(capabilities.supportsCustomImages).toBe(true)
      expect(capabilities.supportsDockerContainers).toBe(true)
      expect(capabilities.maxConcurrentTasks).toBe(10)
      expect(capabilities.maxTaskDuration).toBe(24 * 60 * 60 * 1000) // 24 hours
    })
  })

  describe('Configuration validation', () => {
    test('should validate valid configuration', async () => {
      const result = await provider.validateConfig(mockConfig)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should reject invalid region', async () => {
      const invalidConfig = { ...mockConfig, region: '' }
      const result = await provider.validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('AWS region is required')
    })

    test('should reject invalid instance type', async () => {
      const invalidConfig = { ...mockConfig, instanceType: '' }
      const result = await provider.validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('EC2 instance type is required')
    })

    test('should warn about very short idle timeout', async () => {
      const shortTimeoutConfig = { ...mockConfig, idleTimeout: 5 }
      const result = await provider.validateConfig(shortTimeoutConfig)
      
      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('Idle timeout less than 30 minutes may cause frequent terminations')
    })

    test('should warn about spot instances for critical tasks', async () => {
      const spotConfig = { ...mockConfig, spotInstance: true }
      const result = await provider.validateConfig(spotConfig)
      
      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('Spot instances may be interrupted unexpectedly')
    })
  })

  describe('Environment lifecycle', () => {
    test('should create environment with default options', async () => {
      // Mock EC2 client responses
      const mockRunInstances = jest.fn().mockResolvedValue({
        Instances: [{
          InstanceId: 'i-1234567890abcdef0',
          State: { Name: 'pending' },
          PublicIpAddress: '1.2.3.4',
          PrivateIpAddress: '10.0.1.100'
        }]
      })

      const mockDescribeInstances = jest.fn().mockResolvedValue({
        Reservations: [{
          Instances: [{
            InstanceId: 'i-1234567890abcdef0',
            State: { Name: 'running' },
            PublicIpAddress: '1.2.3.4',
            PrivateIpAddress: '10.0.1.100'
          }]
        }]
      })

      // Mock the AWS client
      const { EC2Client } = require('@aws-sdk/client-ec2')
      EC2Client.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'RunInstancesCommand') {
          return mockRunInstances()
        } else if (command.constructor.name === 'DescribeInstancesCommand') {
          return mockDescribeInstances()
        }
      })

      const environment = await provider.createEnvironment()

      expect(environment.id).toBe('i-1234567890abcdef0')
      expect(environment.provider).toBe(ComputeProviderType.EC2)
      expect(environment.status).toBe(EnvironmentStatus.RUNNING)
      expect(environment.metadata).toMatchObject({
        instanceId: 'i-1234567890abcdef0',
        publicIp: '1.2.3.4',
        privateIp: '10.0.1.100'
      })
    })

    test('should create environment with custom options', async () => {
      const mockRunInstances = jest.fn().mockResolvedValue({
        Instances: [{
          InstanceId: 'i-1234567890abcdef0',
          State: { Name: 'pending' }
        }]
      })

      const { EC2Client } = require('@aws-sdk/client-ec2')
      EC2Client.prototype.send = jest.fn().mockResolvedValue(mockRunInstances())

      const options = {
        name: 'custom-env',
        machineType: 'c5.xlarge',
        metadata: {
          keyPair: 'my-key',
          securityGroups: ['sg-12345']
        }
      }

      await provider.createEnvironment(options)

      expect(EC2Client.prototype.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            InstanceType: 'c5.xlarge',
            KeyName: 'my-key',
            SecurityGroupIds: ['sg-12345']
          })
        })
      )
    })

    test('should get environment status', async () => {
      const mockDescribeInstances = jest.fn().mockResolvedValue({
        Reservations: [{
          Instances: [{
            InstanceId: 'i-1234567890abcdef0',
            State: { Name: 'running' }
          }]
        }]
      })

      const { EC2Client } = require('@aws-sdk/client-ec2')
      EC2Client.prototype.send = jest.fn().mockResolvedValue(mockDescribeInstances())

      const status = await provider.getEnvironmentStatus('i-1234567890abcdef0')

      expect(status).toBe(EnvironmentStatus.RUNNING)
    })

    test('should destroy environment', async () => {
      const mockTerminateInstances = jest.fn().mockResolvedValue({
        TerminatingInstances: [{
          InstanceId: 'i-1234567890abcdef0',
          CurrentState: { Name: 'shutting-down' }
        }]
      })

      const { EC2Client } = require('@aws-sdk/client-ec2')
      EC2Client.prototype.send = jest.fn().mockResolvedValue(mockTerminateInstances())

      await provider.destroyEnvironment('i-1234567890abcdef0')

      expect(EC2Client.prototype.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            InstanceIds: ['i-1234567890abcdef0']
          })
        })
      )
    })

    test('should list environments', async () => {
      const mockDescribeInstances = jest.fn().mockResolvedValue({
        Reservations: [{
          Instances: [{
            InstanceId: 'i-1234567890abcdef0',
            State: { Name: 'running' },
            Tags: [{ Key: 'Project', Value: 'remote-claude' }]
          }, {
            InstanceId: 'i-0987654321fedcba0',
            State: { Name: 'stopped' },
            Tags: [{ Key: 'Project', Value: 'remote-claude' }]
          }]
        }]
      })

      const { EC2Client } = require('@aws-sdk/client-ec2')
      EC2Client.prototype.send = jest.fn().mockResolvedValue(mockDescribeInstances())

      const environments = await provider.listEnvironments()

      expect(environments).toHaveLength(2)
      expect(environments[0]?.id).toBe('i-1234567890abcdef0')
      expect(environments[0]?.status).toBe(EnvironmentStatus.RUNNING)
      expect(environments[1]?.id).toBe('i-0987654321fedcba0')
      expect(environments[1]?.status).toBe(EnvironmentStatus.STOPPED)
    })
  })

  describe('Task execution', () => {
    test('should execute task successfully', async () => {
      const mockEnvironment = {
        id: 'i-1234567890abcdef0',
        provider: ComputeProviderType.EC2,
        status: EnvironmentStatus.RUNNING,
        createdAt: new Date(),
        metadata: {
          publicIp: '1.2.3.4',
          keyPair: 'test-key'
        }
      }

      const mockTask = {
        id: 'task-123',
        command: 'echo "Hello World"',
        timeout: 300
      }

      // Mock SSH connection
      const mockSSHClient = {
        connect: jest.fn(),
        exec: jest.fn((command, callback) => {
          const mockStream = {
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler('Hello World\n')
              } else if (event === 'end') {
                handler()
              }
            }),
            stderr: {
              on: jest.fn()
            }
          }
          callback(null, mockStream)
        }),
        end: jest.fn()
      }

      const { Client } = require('ssh2')
      Client.mockImplementation(() => mockSSHClient)

      const execution = await provider.executeTask(mockEnvironment, mockTask)

      expect(execution.id).toBe('task-123')
      expect(execution.environmentId).toBe('i-1234567890abcdef0')
      expect(execution.status).toBe(TaskStatus.COMPLETED)
      expect(execution.exitCode).toBe(0)
      expect(execution.output).toContain('Hello World')
    })

    test('should handle task execution failure', async () => {
      const mockEnvironment = {
        id: 'i-1234567890abcdef0',
        provider: ComputeProviderType.EC2,
        status: EnvironmentStatus.RUNNING,
        createdAt: new Date(),
        metadata: {
          publicIp: '1.2.3.4',
          keyPair: 'test-key'
        }
      }

      const mockTask = {
        id: 'task-123',
        command: 'false', // Command that fails
        timeout: 300
      }

      // Mock SSH connection with error
      const mockSSHClient = {
        connect: jest.fn(),
        exec: jest.fn((command, callback) => {
          const mockStream = {
            on: jest.fn((event, handler) => {
              if (event === 'exit') {
                handler(1) // Exit code 1 (failure)
              } else if (event === 'end') {
                handler()
              }
            }),
            stderr: {
              on: jest.fn((event, handler) => {
                if (event === 'data') {
                  handler('Command failed\n')
                }
              })
            }
          }
          callback(null, mockStream)
        }),
        end: jest.fn()
      }

      const { Client } = require('ssh2')
      Client.mockImplementation(() => mockSSHClient)

      const execution = await provider.executeTask(mockEnvironment, mockTask)

      expect(execution.status).toBe(TaskStatus.FAILED)
      expect(execution.exitCode).toBe(1)
      expect(execution.error).toContain('Command failed')
    })

    test('should get task status', async () => {
      // For EC2, we don't track individual task status separately
      // This test verifies the method exists and returns a reasonable default
      const status = await provider.getTaskStatus('i-1234567890abcdef0', 'task-123')
      expect(Object.values(TaskStatus)).toContain(status)
    })

    test('should cancel running task', async () => {
      // Mock cancellation - this would typically send a signal to the process
      await expect(provider.cancelTask('i-1234567890abcdef0', 'task-123')).resolves.not.toThrow()
    })
  })

  describe('File operations', () => {
    test('should upload files', async () => {
      const files = {
        '/tmp/test.txt': 'Hello World',
        '/tmp/data.json': JSON.stringify({ test: true })
      }

      // Mock SFTP client
      const mockSFTPClient = {
        writeFile: jest.fn((path, data, callback) => callback()),
        end: jest.fn()
      }

      const mockSSHClient = {
        connect: jest.fn(),
        sftp: jest.fn((callback) => callback(null, mockSFTPClient)),
        end: jest.fn()
      }

      const { Client } = require('ssh2')
      Client.mockImplementation(() => mockSSHClient)

      await provider.uploadFiles('i-1234567890abcdef0', files)

      expect(mockSFTPClient.writeFile).toHaveBeenCalledTimes(2)
      expect(mockSFTPClient.writeFile).toHaveBeenCalledWith('/tmp/test.txt', 'Hello World', expect.any(Function))
      expect(mockSFTPClient.writeFile).toHaveBeenCalledWith('/tmp/data.json', JSON.stringify({ test: true }), expect.any(Function))
    })

    test('should download files', async () => {
      const paths = ['/tmp/output.txt', '/tmp/results.json']

      // Mock SFTP client
      const mockSFTPClient = {
        readFile: jest.fn((path, callback) => {
          if (path === '/tmp/output.txt') {
            callback(null, Buffer.from('Task completed'))
          } else if (path === '/tmp/results.json') {
            callback(null, Buffer.from('{"success": true}'))
          }
        }),
        end: jest.fn()
      }

      const mockSSHClient = {
        connect: jest.fn(),
        sftp: jest.fn((callback) => callback(null, mockSFTPClient)),
        end: jest.fn()
      }

      const { Client } = require('ssh2')
      Client.mockImplementation(() => mockSSHClient)

      const files = await provider.downloadResults('i-1234567890abcdef0', paths)

      expect(files['/tmp/output.txt']).toBe('Task completed')
      expect(files['/tmp/results.json']).toBe('{"success": true}')
    })
  })

  describe('State mapping', () => {
    test('should map EC2 instance states correctly', () => {
      // This tests the private mapInstanceState method indirectly
      // by checking the behavior of getEnvironmentStatus
      
      expect(provider['mapInstanceState']('pending')).toBe(EnvironmentStatus.CREATING)
      expect(provider['mapInstanceState']('running')).toBe(EnvironmentStatus.RUNNING)
      expect(provider['mapInstanceState']('stopping')).toBe(EnvironmentStatus.STOPPING)
      expect(provider['mapInstanceState']('stopped')).toBe(EnvironmentStatus.STOPPED)
      expect(provider['mapInstanceState']('terminated')).toBe(EnvironmentStatus.STOPPED)
      expect(provider['mapInstanceState']('unknown')).toBe(EnvironmentStatus.ERROR)
    })
  })

  describe('Error handling', () => {
    test('should handle AWS API errors gracefully', async () => {
      const mockError = new Error('AWS API Error')
      mockError.name = 'InvalidInstanceId.NotFound'

      const { EC2Client } = require('@aws-sdk/client-ec2')
      EC2Client.prototype.send = jest.fn().mockRejectedValue(mockError)

      await expect(provider.getEnvironmentStatus('i-invalid')).rejects.toThrow('AWS API Error')
    })

    test('should handle SSH connection errors', async () => {
      const mockEnvironment = {
        id: 'i-1234567890abcdef0',
        provider: ComputeProviderType.EC2,
        status: EnvironmentStatus.RUNNING,
        createdAt: new Date(),
        metadata: {
          publicIp: '1.2.3.4',
          keyPair: 'test-key'
        }
      }

      const mockTask = {
        id: 'task-123',
        command: 'echo "test"',
        timeout: 300
      }

      const mockSSHClient = {
        connect: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Connection failed')), 10)
          }
        }),
        end: jest.fn()
      }

      const { Client } = require('ssh2')
      Client.mockImplementation(() => mockSSHClient)

      await expect(provider.executeTask(mockEnvironment, mockTask)).rejects.toThrow('Connection failed')
    })
  })
})