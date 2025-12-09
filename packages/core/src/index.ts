// Type exports - be selective to avoid conflicts
export * from './types';
// Don't re-export all from compute types to avoid conflicts
export type { 
  ComputeProvider,
  ComputeProviderType,
  Environment,
  EnvironmentOptions,
  EnvironmentStatus as ComputeEnvironmentStatus,
  TaskDefinition as ComputeTaskDefinition,
  TaskExecution,
  TaskStatus as ComputeTaskStatus,
  FileMap,
  LogCallback,
  ValidationResult,
  ProviderCapabilities,
  ComputeConfig,
  EC2Config,
  CodespaceConfig as ComputeCodespaceConfig
} from './types/compute';

// Task v2 types
export * from './types/task-v2';

// Notification v2 types  
export * from './types/notification-v2';

// Provider exports
export { CodespaceProvider } from './providers/compute/codespace-provider';
export { EC2Provider } from './providers/compute/ec2-provider';
export { AzureACIProvider } from './providers/compute/azure-aci-provider';
export type { AzureACIConfig } from './providers/compute/azure-aci-provider';
export { ComputeManager } from './providers/compute/manager';
export * from './providers/compute/provider-factory';

// Codespace exports
export * from './providers/codespace/github-api';
export { CodespaceManager } from './providers/codespace/manager';

// Task exports
export { TaskManager } from './tasks/manager';
export { TaskQueue } from './tasks/queue';
export { TaskStorage } from './tasks/storage';

// Utility exports
export * from './utils/date';
export * from './utils/logger';
export * from './utils/config';