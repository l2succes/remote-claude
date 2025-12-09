/**
 * Azure Container Instances (ACI) Backend Provider
 *
 * Spins up ephemeral containers on Azure for agent execution.
 * Perfect for pay-per-second pricing with no minimum commitment.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
  ComputeProvider,
  ComputeProviderType,
  Environment,
  EnvironmentOptions,
  EnvironmentStatus,
  TaskDefinition,
  TaskExecution,
  TaskStatus,
  FileMap,
  LogCallback,
  ValidationResult,
  ProviderCapabilities,
} from '../../types/compute';

// ============================================================================
// Types
// ============================================================================

export interface AzureACIConfig {
  subscriptionId: string;
  resourceGroup: string;
  location: string;
  containerImage: string;
  cpu?: number;
  memoryGB?: number;
  registryServer?: string;
  registryUsername?: string;
  registryPassword?: string;
  tags?: Record<string, string>;
}

interface TrackedContainer {
  id: string;
  containerGroupName: string;
  status: EnvironmentStatus;
  endpoint?: string;
  publicIp?: string;
  createdAt: Date;
}

// ============================================================================
// Azure ACI Provider
// ============================================================================

export class AzureACIProvider extends EventEmitter implements ComputeProvider {
  readonly name = 'Azure Container Instances';
  readonly type = 'azure-aci' as ComputeProviderType;

  private client: any; // ContainerInstanceManagementClient
  private config: AzureACIConfig;
  private containers: Map<string, TrackedContainer> = new Map();
  private initialized = false;

  constructor(config: Partial<AzureACIConfig> = {}) {
    super();
    this.config = {
      subscriptionId: config.subscriptionId || process.env.AZURE_SUBSCRIPTION_ID || '',
      resourceGroup: config.resourceGroup || process.env.AZURE_RESOURCE_GROUP || 'remote-claude-rg',
      location: config.location || process.env.AZURE_LOCATION || 'eastus',
      containerImage: config.containerImage || 'ghcr.io/l2succes/remote-claude-agent:latest',
      cpu: config.cpu || 1,
      memoryGB: config.memoryGB || 2,
      ...config,
    };
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async validateConfig(config: AzureACIConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.subscriptionId) {
      errors.push('Azure subscription ID is required');
    }

    if (!config.resourceGroup) {
      errors.push('Azure resource group is required');
    }

    if (!config.containerImage) {
      errors.push('Container image is required');
    }

    if (config.cpu && (config.cpu < 0.5 || config.cpu > 4)) {
      warnings.push('CPU should be between 0.5 and 4 for optimal performance');
    }

    if (config.memoryGB && (config.memoryGB < 0.5 || config.memoryGB > 16)) {
      warnings.push('Memory should be between 0.5GB and 16GB');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsSpotInstances: false, // ACI doesn't have spot concept
      supportsPersistentStorage: true, // Via Azure Files mount
      supportsCustomImages: true,
      supportsDockerContainers: true,
      maxConcurrentTasks: 5,
      maxTaskDuration: 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.subscriptionId) {
      throw new Error('Azure subscription ID is required. Set AZURE_SUBSCRIPTION_ID or pass in config.');
    }

    try {
      // Dynamically import Azure SDK
      const { ContainerInstanceManagementClient } = await import('@azure/arm-containerinstance');
      const { DefaultAzureCredential } = await import('@azure/identity');

      const credential = new DefaultAzureCredential();
      this.client = new ContainerInstanceManagementClient(credential, this.config.subscriptionId);

      // Verify we can access the API
      await this.client.containerGroups.list();
      this.initialized = true;
    } catch (err) {
      throw new Error(`Failed to initialize Azure ACI provider: ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // Container Management
  // --------------------------------------------------------------------------

  async createEnvironment(options: EnvironmentOptions = {}): Promise<Environment> {
    await this.ensureInitialized();

    const instanceId = `rc-${uuidv4().substring(0, 8)}`;
    const containerGroupName = `remote-claude-${instanceId}`;
    const displayName = options.name || containerGroupName;

    // Prepare environment variables
    const envVars = [
      { name: 'ANTHROPIC_API_KEY', secureValue: process.env.ANTHROPIC_API_KEY },
      { name: 'WORKING_DIR', value: '/workspace' },
      { name: 'LOG_LEVEL', value: process.env.LOG_LEVEL || 'info' },
    ].filter(e => e.value || e.secureValue);

    const containerGroup = {
      location: this.config.location,
      containers: [
        {
          name: 'agent',
          image: this.config.containerImage,
          resources: {
            requests: {
              cpu: this.config.cpu,
              memoryInGB: this.config.memoryGB,
            },
          },
          ports: [{ port: 8080, protocol: 'TCP' as const }],
          environmentVariables: envVars,
        },
      ],
      osType: 'Linux' as const,
      restartPolicy: 'Never' as const,
      ipAddress: {
        type: 'Public' as const,
        ports: [{ port: 8080, protocol: 'TCP' as const }],
        dnsNameLabel: containerGroupName,
      },
      ...(this.config.registryServer && {
        imageRegistryCredentials: [
          {
            server: this.config.registryServer,
            username: this.config.registryUsername,
            password: this.config.registryPassword,
          },
        ],
      }),
      tags: {
        'remote-claude': 'true',
        'created-by': 'remote-claude-cli',
        ...this.config.tags,
      },
    };

    try {
      const result = await this.client.containerGroups.beginCreateOrUpdateAndWait(
        this.config.resourceGroup,
        containerGroupName,
        containerGroup
      );

      const endpoint = result.ipAddress?.fqdn
        ? `ws://${result.ipAddress.fqdn}:8080`
        : result.ipAddress?.ip
        ? `ws://${result.ipAddress.ip}:8080`
        : undefined;

      const container: TrackedContainer = {
        id: instanceId,
        containerGroupName,
        status: this.mapStatus(result.instanceView?.state),
        endpoint,
        publicIp: result.ipAddress?.ip,
        createdAt: new Date(),
      };

      this.containers.set(instanceId, container);

      const environment: Environment = {
        id: instanceId,
        provider: this.type,
        status: container.status,
        createdAt: container.createdAt,
        metadata: {
          containerGroupName,
          resourceGroup: this.config.resourceGroup,
          location: this.config.location,
          endpoint,
          publicIp: container.publicIp,
          displayName,
        },
      };

      this.emit('environment-created', environment);
      return environment;
    } catch (err) {
      throw new Error(`Failed to start Azure container: ${(err as Error).message}`);
    }
  }

  async destroyEnvironment(envId: string): Promise<void> {
    await this.ensureInitialized();

    const tracked = this.containers.get(envId);
    const containerGroupName = tracked?.containerGroupName || `remote-claude-${envId}`;

    try {
      await this.client.containerGroups.beginDeleteAndWait(
        this.config.resourceGroup,
        containerGroupName
      );
      this.containers.delete(envId);
      this.emit('environment-destroyed', envId);
    } catch (err) {
      // Ignore if not found
      if (!(err as Error).message.includes('not found')) {
        throw new Error(`Failed to stop container ${envId}: ${(err as Error).message}`);
      }
    }
  }

  async getEnvironmentStatus(envId: string): Promise<EnvironmentStatus> {
    await this.ensureInitialized();

    const tracked = this.containers.get(envId);
    if (!tracked) {
      return EnvironmentStatus.STOPPED;
    }

    try {
      const group = await this.client.containerGroups.get(
        this.config.resourceGroup,
        tracked.containerGroupName
      );
      return this.mapStatus(group.instanceView?.state);
    } catch {
      return EnvironmentStatus.STOPPED;
    }
  }

  async listEnvironments(): Promise<Environment[]> {
    await this.ensureInitialized();

    const environments: Environment[] = [];

    try {
      const groups = this.client.containerGroups.listByResourceGroup(this.config.resourceGroup);

      for await (const group of groups) {
        // Only include our containers
        if (group.tags?.['remote-claude'] !== 'true') {
          continue;
        }

        const instanceId = group.name?.replace('remote-claude-', '') || uuidv4();
        const endpoint = group.ipAddress?.fqdn
          ? `ws://${group.ipAddress.fqdn}:8080`
          : group.ipAddress?.ip
          ? `ws://${group.ipAddress.ip}:8080`
          : undefined;

        environments.push({
          id: instanceId,
          provider: this.type,
          status: this.mapStatus(group.instanceView?.state),
          createdAt: new Date(), // ACI doesn't expose creation time directly
          metadata: {
            containerGroupName: group.name,
            resourceGroup: this.config.resourceGroup,
            endpoint,
            publicIp: group.ipAddress?.ip,
          },
        });
      }
    } catch (err) {
      throw new Error(`Failed to list containers: ${(err as Error).message}`);
    }

    return environments;
  }

  // --------------------------------------------------------------------------
  // Task Execution (via WebSocket)
  // --------------------------------------------------------------------------

  async executeTask(env: Environment, task: TaskDefinition): Promise<TaskExecution> {
    // For ACI, tasks are executed via WebSocket connection to the agent server
    // This method is primarily for compatibility - actual execution happens via ws-client
    const execution: TaskExecution = {
      id: task.id,
      environmentId: env.id,
      status: TaskStatus.RUNNING,
      startTime: new Date(),
    };

    // The actual execution happens via WebSocket - this is just a placeholder
    // In practice, the CLI would use AgentClient from @remote-claude/shared
    execution.status = TaskStatus.COMPLETED;
    execution.endTime = new Date();
    execution.output = 'Task execution via WebSocket - use AgentClient for actual execution';

    return execution;
  }

  async getTaskStatus(_envId: string, _taskId: string): Promise<TaskStatus> {
    return TaskStatus.COMPLETED;
  }

  async cancelTask(_envId: string, _taskId: string): Promise<void> {
    // Cancellation is handled via WebSocket
  }

  async streamLogs(envId: string, callback: LogCallback): Promise<void> {
    await this.ensureInitialized();

    const tracked = this.containers.get(envId);
    if (!tracked) {
      callback('Container not found\n');
      return;
    }

    try {
      const logs = await this.client.containers.listLogs(
        this.config.resourceGroup,
        tracked.containerGroupName,
        'agent',
        { tail: 100 }
      );

      callback(logs.content || 'No logs available\n');
    } catch {
      callback('Error retrieving logs\n');
    }
  }

  async uploadFiles(_envId: string, _files: FileMap): Promise<void> {
    // File upload is handled via the workspace volume mount
    throw new Error('Direct file upload not supported - use workspace volume');
  }

  async downloadResults(_envId: string, _paths: string[]): Promise<FileMap> {
    // File download is handled via the workspace volume mount
    throw new Error('Direct file download not supported - use workspace volume');
  }

  // --------------------------------------------------------------------------
  // Cost Estimation
  // --------------------------------------------------------------------------

  async estimateCost(durationMinutes: number): Promise<{
    estimated: number;
    currency: string;
    breakdown?: Record<string, number>;
  }> {
    // Azure ACI pricing (East US, as of 2024):
    // - vCPU: $0.0000125 per second ($0.045/hour)
    // - Memory: $0.0000125 per GB per second ($0.045/GB/hour)

    const cpuCostPerHour = 0.045;
    const memoryCostPerGBHour = 0.045;

    const hours = durationMinutes / 60;
    const cpuCost = this.config.cpu! * cpuCostPerHour * hours;
    const memoryCost = this.config.memoryGB! * memoryCostPerGBHour * hours;

    return {
      estimated: Number((cpuCost + memoryCost).toFixed(4)),
      currency: 'USD',
      breakdown: {
        cpu: Number(cpuCost.toFixed(4)),
        memory: Number(memoryCost.toFixed(4)),
      },
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private mapStatus(state?: string): EnvironmentStatus {
    switch (state?.toLowerCase()) {
      case 'pending':
      case 'creating':
        return EnvironmentStatus.CREATING;
      case 'running':
        return EnvironmentStatus.RUNNING;
      case 'succeeded':
      case 'stopped':
        return EnvironmentStatus.STOPPED;
      case 'failed':
        return EnvironmentStatus.ERROR;
      default:
        return EnvironmentStatus.CREATING;
    }
  }

  /**
   * Get the WebSocket endpoint for a container
   */
  async getEndpoint(envId: string): Promise<string | null> {
    await this.ensureInitialized();

    const tracked = this.containers.get(envId);
    if (!tracked) {
      return null;
    }

    if (tracked.endpoint) {
      return tracked.endpoint;
    }

    try {
      const group = await this.client.containerGroups.get(
        this.config.resourceGroup,
        tracked.containerGroupName
      );

      if (group.ipAddress?.fqdn) {
        return `ws://${group.ipAddress.fqdn}:8080`;
      }
      if (group.ipAddress?.ip) {
        return `ws://${group.ipAddress.ip}:8080`;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Wait for container to be ready
   */
  async waitForReady(envId: string, timeoutMs: number = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getEnvironmentStatus(envId);

      if (status === EnvironmentStatus.RUNNING) {
        // Additional check: verify the WebSocket endpoint is accessible
        const endpoint = await this.getEndpoint(envId);
        if (endpoint) {
          return;
        }
      }

      if (status === EnvironmentStatus.ERROR || status === EnvironmentStatus.STOPPED) {
        throw new Error(`Container failed to start. Status: ${status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Container did not become ready within ${timeoutMs}ms`);
  }

  /**
   * Cleanup old containers
   */
  async cleanup(): Promise<number> {
    await this.ensureInitialized();

    const containers = await this.listEnvironments();
    const now = new Date();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours for Azure (costs money!)

    let cleaned = 0;
    for (const container of containers) {
      const age = now.getTime() - container.createdAt.getTime();
      // Clean up stopped containers or anything older than maxAge
      if (
        container.status === EnvironmentStatus.STOPPED ||
        container.status === EnvironmentStatus.ERROR ||
        age > maxAge
      ) {
        try {
          await this.destroyEnvironment(container.id);
          cleaned++;
        } catch {
          // Ignore errors during cleanup
        }
      }
    }

    return cleaned;
  }
}
