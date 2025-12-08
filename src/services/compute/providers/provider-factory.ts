import { ComputeProvider } from '../types'
import { ECSProvider, ECSProviderConfig } from './ecs-ec2/ecs-provider'
import { Logger } from '../../../utils/logger'
import { Config } from '../../../utils/config'

export type ProviderType = 'aws' | 'fly' | 'local'

export interface ProviderConfig {
  type: ProviderType
  enabled: boolean
  isDefault?: boolean
  config?: Record<string, any>
}

export class ProviderFactory {
  private static logger = new Logger('ProviderFactory')
  private static providers: Map<string, ComputeProvider> = new Map()
  private static initialized = false

  static async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.logger.info('Initializing compute providers')

    // Load provider configurations
    const providerConfigs = this.loadProviderConfigs()

    // Initialize each enabled provider
    for (const [name, config] of Object.entries(providerConfigs)) {
      if (config.enabled) {
        try {
          const provider = await this.createProvider(config)
          if (provider) {
            await provider.initialize()
            this.providers.set(name, provider)
            this.logger.info(`Provider ${name} initialized successfully`)
          }
        } catch (error: any) {
          this.logger.error(`Failed to initialize provider ${name}`, { error })
          
          // If AWS setup is required, don't try other providers
          if (error.message === 'AWS_SETUP_REQUIRED') {
            this.logger.info('AWS setup required. Stopping provider initialization.')
            break
          }
        }
      }
    }

    this.initialized = true
  }

  static async getProvider(name?: string): Promise<ComputeProvider> {
    if (!this.initialized) {
      await this.initialize()
    }

    // If no name specified, return default provider
    if (!name) {
      name = this.getDefaultProviderName()
    }

    const provider = this.providers.get(name)
    if (!provider) {
      // Check if it's an AWS provider that failed to initialize
      if (name === 'aws') {
        throw new Error(`AWS provider '${name}' is not available. This usually means AWS is not properly configured or the infrastructure hasn't been deployed.`)
      }
      throw new Error(`Provider ${name} not found or not initialized`)
    }

    return provider
  }

  static async getAvailableProviders(): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    return Array.from(this.providers.keys())
  }

  static async shutdown(): Promise<void> {
    this.logger.info('Shutting down all providers')

    for (const [name, provider] of this.providers) {
      try {
        await provider.shutdown()
        this.logger.info(`Provider ${name} shut down successfully`)
      } catch (error) {
        this.logger.error(`Error shutting down provider ${name}`, { error })
      }
    }

    this.providers.clear()
    this.initialized = false
  }

  private static async createProvider(config: ProviderConfig): Promise<ComputeProvider | null> {
    switch (config.type) {
      case 'aws':
        // Always use ECS for AWS
        return new ECSProvider({
          clusterName: Config.get('aws.ecs.clusterName') || Config.get('ecs.clusterName') || 'remote-claude-cluster',
          region: Config.get('aws.region') || 'us-east-1',
          subnetIds: Config.get('aws.ecs.subnetIds') || Config.get('ecs.subnetIds') || [],
          securityGroupIds: Config.get('aws.ecs.securityGroupIds') || Config.get('ecs.securityGroupIds') || [],
          instanceType: Config.get('aws.ecs.instanceType') || Config.get('ecs.instanceType') || 't3.medium',
          minInstances: Config.get('ecs.minInstances') || 1,
          maxInstances: Config.get('ecs.maxInstances') || 10,
          enableSpot: Config.get('ecs.enableSpot') || true,
          containerInsights: Config.get('ecs.containerInsights') || true,
          ...config.config,
        } as ECSProviderConfig)

      case 'fly':
        // Placeholder for Fly.io provider
        this.logger.warn('Fly.io provider not yet implemented')
        return null

      case 'local':
        // Placeholder for local development provider
        this.logger.warn('Local provider not yet implemented')
        return null

      default:
        this.logger.error(`Unknown provider type: ${config.type}`)
        return null
    }
  }

  private static loadProviderConfigs(): Record<string, ProviderConfig> {
    // Load from config file or environment
    const configs: Record<string, ProviderConfig> = {}

    // AWS Provider (uses ECS)
    if (Config.get('providers.aws.enabled') !== false) {
      configs['aws'] = {
        type: 'aws',
        enabled: true,
        isDefault: Config.get('providers.default') === 'aws' || Config.get('defaultBackend') === 'aws',
        config: Config.get('providers.aws.config') || {},
      }
    }

    // Fly.io Provider (future)
    if (Config.get('providers.fly.enabled') === true) {
      configs['fly'] = {
        type: 'fly',
        enabled: true,
        isDefault: Config.get('providers.default') === 'fly',
        config: Config.get('providers.fly.config') || {},
      }
    }

    // Local Provider (development)
    if (Config.get('providers.local.enabled') === true) {
      configs['local'] = {
        type: 'local',
        enabled: true,
        isDefault: Config.get('providers.default') === 'local',
        config: Config.get('providers.local.config') || {},
      }
    }

    return configs
  }

  private static getDefaultProviderName(): string {
    const configs = this.loadProviderConfigs()
    
    // Find explicitly marked default
    for (const [name, config] of Object.entries(configs)) {
      if (config.isDefault && config.enabled) {
        return name
      }
    }

    // Fallback to first enabled provider
    for (const [name, config] of Object.entries(configs)) {
      if (config.enabled) {
        return name
      }
    }

    throw new Error('No enabled providers found')
  }
}

// Provider selection strategy
export class ProviderSelector {
  private static logger = new Logger('ProviderSelector')

  static async selectProviderForTask(task: {
    repository: string
    expectedDuration?: number
    requiresGPU?: boolean
    preferredRegion?: string
    budget?: number
  }): Promise<string> {
    const providers = await ProviderFactory.getAvailableProviders()

    // Simple selection logic for now
    // Can be enhanced with more sophisticated algorithms

    // Short tasks prefer Fly.io (when available)
    if (task.expectedDuration && task.expectedDuration < 300 && providers.includes('fly')) {
      return 'fly'
    }

    // GPU tasks need AWS
    if (task.requiresGPU) {
      return providers.includes('aws') ? 'aws' : 'aws'
    }

    // Default to AWS for production workloads
    if (providers.includes('aws')) {
      return 'aws'
    }

    // Fallback to any available provider
    return providers[0] || 'aws'
  }

  static async getProviderCapabilities(providerName: string): Promise<{
    supportsGPU: boolean
    supportsSpot: boolean
    regions: string[]
    minDuration: number
    maxDuration: number
    costPerHour: number
  }> {
    // Return capabilities based on provider type
    switch (providerName) {
      case 'aws':
        return {
          supportsGPU: true,
          supportsSpot: true,
          regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
          minDuration: 60, // 1 minute
          maxDuration: 86400, // 24 hours
          costPerHour: 0.10,
        }

      case 'fly':
        return {
          supportsGPU: false,
          supportsSpot: false,
          regions: ['iad', 'lhr', 'nrt', 'syd', 'ams', 'fra'],
          minDuration: 1, // 1 second
          maxDuration: 86400,
          costPerHour: 0.05,
        }

      default:
        throw new Error(`Unknown provider: ${providerName}`)
    }
  }
}