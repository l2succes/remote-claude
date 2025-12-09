/**
 * Core types for Remote Claude Agent SDK integration
 */

// ============================================================================
// Backend Types
// ============================================================================

export type BackendType = 'azure-aci' | 'aws-ec2' | 'aws-ecs' | 'codespaces' | 'local';

export interface BackendConfig {
  // Azure ACI
  azure?: {
    subscriptionId: string;
    resourceGroup: string;
    location?: string;
    containerImage?: string;
    cpu?: number;
    memoryGB?: number;
  };

  // AWS EC2
  ec2?: {
    region?: string;
    instanceType?: string;
    spotInstance?: boolean;
    amiId?: string;
    securityGroupId?: string;
    subnetId?: string;
    keyName?: string;
  };

  // AWS ECS (Fargate)
  ecs?: {
    region?: string;
    cluster?: string;
    taskDefinition?: string;
    cpu?: string;
    memory?: string;
  };

  // GitHub Codespaces
  codespaces?: {
    machine?: string;
    idleTimeout?: number;
    repository?: string;
  };
}

export interface ContainerInstance {
  id: string;
  backend: BackendType;
  status: ContainerStatus;
  endpoint?: string; // WebSocket URL
  publicIp?: string;
  privateIp?: string;
  createdAt: Date;
  metadata?: Record<string, string>;
}

export type ContainerStatus =
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed';

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface MCPToolCall {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

// ============================================================================
// Task Types for Agent SDK
// ============================================================================

export interface AgentTask {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  systemPrompt?: string;

  // Execution config
  maxTurns?: number;
  timeout?: number; // seconds
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';

  // MCP configuration
  mcpServers?: Record<string, MCPServerConfig>;

  // Git/repo config
  repository?: string;
  branch?: string;
  workingDirectory?: string;

  // Backend preference
  backend?: BackendType;
  backendConfig?: BackendConfig;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  runCount: number;
}

export interface AgentTaskRun {
  id: string;
  taskId: string;
  status: AgentTaskRunStatus;

  // Execution details
  backend: BackendType;
  containerId?: string;
  instanceId?: string;

  // Timing
  startedAt: Date;
  completedAt?: Date;

  // Results
  output?: string;
  error?: string;
  exitCode?: number;

  // Cost tracking
  tokensUsed?: number;
  estimatedCost?: number;
  computeCost?: number;
}

export type AgentTaskRunStatus =
  | 'pending'
  | 'provisioning'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

// ============================================================================
// Session Types
// ============================================================================

export interface AgentSession {
  id: string;
  taskRunId: string;
  containerId: string;

  // Connection
  websocketUrl: string;
  connected: boolean;

  // State
  messages: AgentSessionMessage[];
  currentTurn: number;

  // Timing
  createdAt: Date;
  lastActivityAt: Date;
}

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentBlock[];
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
}

// ============================================================================
// Cost Estimation
// ============================================================================

export interface CostEstimate {
  estimated: number;
  currency: string;
  breakdown?: Record<string, number>;
}
