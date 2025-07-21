import { ComputeProvider } from '@remote-claude/core/types/compute'
import { ECSProvider, ECSProviderConfig } from './ecs-ec2/ecs-provider'
import { EC2SharedProvider, SharedEC2Config } from './ec2-shared/ec2-shared-provider'
import { Logger } from '@remote-claude/core/utils/logger'
import { Config } from '@remote-claude/core/utils/config'

export type ProviderType = 'ecs-ec2' | 'ec2-shared' | 'fly' | 'local'

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
        } catch (error) {
          this.logger.error(`Failed to initialize provider ${name}`, { error })
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
      case 'ecs-ec2':
        return new ECSProvider({
          clusterName: Config.get('ecs.clusterName') || 'remote-claude',
          region: Config.get('aws.region') || 'us-east-1',
          subnetIds: Config.get('ecs.subnetIds') || [],
          securityGroupIds: Config.get('ecs.securityGroupIds') || [],
          instanceType: Config.get('ecs.instanceType') || 't3.medium',
          minInstances: Config.get('ecs.minInstances') || 1,
          maxInstances: Config.get('ecs.maxInstances') || 10,
          enableSpot: Config.get('ecs.enableSpot') || true,
          containerInsights: Config.get('ecs.containerInsights') || true,
          ...config.config,
        } as ECSProviderConfig)

      case 'ec2-shared':
        return new EC2SharedProvider({
          enabled: true,
          minInstances: Config.get('ec2.shared.minInstances') || 1,
          maxInstances: Config.get('ec2.shared.maxInstances') || 5,
          maxTasksPerInstance: Config.get('ec2.shared.maxTasksPerInstance') || 10,
          instanceType: Config.get('ec2.shared.instanceType') || 't3.large',
          ...config.config,
        } as SharedEC2Config)

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

    // ECS Provider
    if (Config.get('providers.ecs.enabled') !== false) {
      configs['ecs-ec2'] = {
        type: 'ecs-ec2',
        enabled: true,
        isDefault: Config.get('providers.default') === 'ecs-ec2',
        config: Config.get('providers.ecs.config') || {},
      }
    }

    // EC2 Shared Provider
    if (Config.get('providers.ec2Shared.enabled') !== false) {
      configs['ec2-shared'] = {
        type: 'ec2-shared',
        enabled: true,
        isDefault: Config.get('providers.default') === 'ec2-shared',
        config: Config.get('providers.ec2Shared.config') || {},
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

    // GPU tasks need EC2
    if (task.requiresGPU) {
      return providers.includes('ecs-ec2') ? 'ecs-ec2' : 'ec2-shared'
    }

    // Budget-conscious tasks prefer shared EC2
    if (task.budget && task.budget < 10 && providers.includes('ec2-shared')) {
      return 'ec2-shared'
    }

    // Default to ECS for production workloads
    if (providers.includes('ecs-ec2')) {
      return 'ecs-ec2'
    }

    // Fallback to any available provider
    return providers[0]
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
      case 'ecs-ec2':
        return {
          supportsGPU: true,
          supportsSpot: true,
          regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
          minDuration: 60, // 1 minute
          maxDuration: 86400, // 24 hours
          costPerHour: 0.10,
        }

      case 'ec2-shared':
        return {
          supportsGPU: false,
          supportsSpot: true,
          regions: ['us-east-1'],
          minDuration: 60,
          maxDuration: 86400,
          costPerHour: 0.08,
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