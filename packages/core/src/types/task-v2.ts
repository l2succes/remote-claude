export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  name: string;
  command: string;
  status: TaskStatus;
  priority: TaskPriority;
  repository: string;
  branch?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
  timeout?: number | undefined;
  autoCommit?: boolean | undefined;
  pullRequest?: boolean | undefined;
  outputFiles?: string[] | undefined;
  notifications?: TaskNotifications | undefined;
  metadata?: TaskMetadata | undefined;
}

export interface TaskNotifications {
  channels?: string[] | undefined;
  onStart?: boolean | undefined;
  onComplete?: boolean | undefined;
  onFail?: boolean | undefined;
}

export interface TaskMetadata {
  codespaceId?: string | undefined;
  codespaceName?: string | undefined;
  webhookUrl?: string | undefined;
  estimatedDuration?: number | undefined;
  actualDuration?: number | undefined;
  resourceUsage?: ResourceUsage | undefined;
  errorDetails?: TaskError | undefined;
}

export interface ResourceUsage {
  cpuTime?: number | undefined;
  memoryUsage?: number | undefined;
  diskUsage?: number | undefined;
  networkUsage?: number | undefined;
}

export interface TaskError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: string | undefined;
  files?: TaskFile[] | undefined;
  logs?: string[] | undefined;
  error?: TaskError | undefined;
  metadata?: any;
}

export interface TaskFile {
  path: string;
  size: number;
  hash: string;
  url?: string | undefined;
  content?: string | undefined;
}

export interface QueueOptions {
  maxConcurrent?: number | undefined;
  priorityWeights?: Record<TaskPriority, number> | undefined;
  retryAttempts?: number | undefined;
  retryDelay?: number | undefined;
  timeoutDefault?: number | undefined;
}

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[] | undefined;
  priority?: TaskPriority | TaskPriority[] | undefined;
  repository?: string | undefined;
  branch?: string | undefined;
  createdAfter?: Date | undefined;
  createdBefore?: Date | undefined;
}

export interface TaskUpdate {
  status?: TaskStatus | undefined;
  progress?: number | undefined;
  message?: string | undefined;
  metadata?: Partial<TaskMetadata> | undefined;
}