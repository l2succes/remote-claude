import { Task, TaskResult } from '@remote-claude/core/tasks/types';

export type NotificationChannel = 'email' | 'slack' | 'webhook' | 'pushover';
export type NotificationEvent = 'task:started' | 'task:completed' | 'task:failed' | 'task:cancelled' | 'task:timeout';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationPayload {
  id: string;
  event: NotificationEvent;
  priority: NotificationPriority;
  timestamp: Date;
  task: Task;
  result?: TaskResult | undefined;
  error?: Error | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  subject?: string | undefined;
  title?: string | undefined;
  body: string;
  format: 'text' | 'html' | 'markdown';
  variables: string[];
}

export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannelConfig[];
  templates?: Record<string, NotificationTemplate> | undefined;
  retryAttempts?: number | undefined;
  retryDelay?: number | undefined;
  batchSize?: number | undefined;
  rateLimit?: {
    perMinute?: number | undefined;
    perHour?: number | undefined;
  } | undefined;
}

export interface NotificationChannelConfig {
  channel: NotificationChannel;
  enabled: boolean;
  events: NotificationEvent[];
  priority?: NotificationPriority | undefined;
  config: EmailConfig | SlackConfig | WebhookConfig | PushoverConfig;
}

export interface EmailConfig {
  type: 'email';
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
  cc?: string[] | undefined;
  bcc?: string[] | undefined;
  template?: string | undefined;
}

export interface SlackConfig {
  type: 'slack';
  webhookUrl?: string | undefined;
  token?: string | undefined;
  channel: string;
  username?: string | undefined;
  iconEmoji?: string | undefined;
  iconUrl?: string | undefined;
  template?: string | undefined;
}

export interface WebhookConfig {
  type: 'webhook';
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string> | undefined;
  auth?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string | undefined;
    username?: string | undefined;
    password?: string | undefined;
    apiKey?: string | undefined;
    headerName?: string | undefined;
  } | undefined;
  template?: string | undefined;
}

export interface PushoverConfig {
  type: 'pushover';
  appToken: string;
  userKey: string;
  device?: string | undefined;
  priority?: number | undefined;
  sound?: string | undefined;
  template?: string | undefined;
}

export interface NotificationResult {
  id: string;
  channel: NotificationChannel;
  success: boolean;
  timestamp: Date;
  duration: number;
  error?: string | undefined;
  response?: any;
}

export interface NotificationQueue {
  id: string;
  payload: NotificationPayload;
  channels: NotificationChannel[];
  attempts: number;
  maxAttempts: number;
  nextRetry?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byChannel: Record<NotificationChannel, {
    sent: number;
    failed: number;
    pending: number;
  }>;
  byEvent: Record<NotificationEvent, {
    sent: number;
    failed: number;
  }>;
}

export interface TemplateVariables {
  task: {
    id: string;
    name: string;
    command: string;
    status: string;
    priority: string;
    repository: string;
    branch?: string | undefined;
    createdAt: string;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    duration?: string | undefined;
    url?: string | undefined;
  };
  result?: {
    success: boolean;
    output?: string | undefined;
    error?: string | undefined;
    files?: Array<{
      path: string;
      size: number;
      url?: string | undefined;
    }> | undefined;
  } | undefined;
  metadata?: Record<string, any> | undefined;
}