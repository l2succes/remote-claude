export interface GitHubConfig {
  token: string;
  username?: string;
  repository?: string;
}

export interface NotificationConfig {
  email?: EmailConfig;
  slack?: SlackConfig;
  pushover?: PushoverConfig;
  webhook?: WebhookConfig;
  defaultChannels: string[];
}

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
  from: string;
  to: string[];
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

export interface PushoverConfig {
  appToken: string;
  userKey: string;
  priority?: number;
  sound?: string;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
}

export interface Task {
  id: string;
  description: string;
  repository: string;
  branch?: string;
  status: TaskStatus;
  startTime: Date;
  endTime?: Date;
  codespaceId?: string;
  codespaceUrl?: string;
  options: TaskOptions;
  results?: TaskResults;
  error?: string;
}

export type TaskStatus = 
  | 'pending'
  | 'creating-codespace'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface TaskOptions {
  timeout?: number; // seconds
  notifyChannels?: string[];
  notifyOnStart?: boolean;
  notifyOnComplete?: boolean;
  notifyOnFail?: boolean;
  autoCommit?: boolean;
  branch?: string;
  pullRequest?: boolean;
  outputFiles?: string[];
}

export interface TaskResults {
  filesChanged?: number;
  outputs: string[];
  artifacts: string[];
  logs: string;
  gitCommits?: string[];
  pullRequestUrl?: string;
}

export interface CodespaceConfig {
  repository: string;
  ref: string;
  location?: string;
  machine?: string;
  idleTimeoutMinutes?: number;
  retentionPeriodMinutes?: number;
  devcontainerPath?: string;
}

export interface NotificationEvent {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'task_timeout' | 'task_progress';
  task: Task;
  message: string;
  urgency: 'low' | 'normal' | 'high';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  task: Task;
  results?: TaskResults;
  [key: string]: unknown;
}

export interface CodespaceStatus {
  id: string;
  name: string;
  state: 'Created' | 'Available' | 'Unavailable' | 'Deleted' | 'Archived';
  url: string;
  machine: {
    name: string;
    display_name: string;
    operating_system: string;
    storage_in_bytes: number;
    memory_in_bytes: number;
    cpus: number;
  };
  created_at: string;
  updated_at: string;
}

export interface Config {
  github: GitHubConfig;
  notifications: NotificationConfig;
  defaultOptions: Partial<TaskOptions>;
  webhookPort?: number;
  maxConcurrentTasks?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}