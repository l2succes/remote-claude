# AWS Container Services Comparison for Remote Claude

## Requirements Recap
- Docker containers that persist in background (even after session closes)
- Container-per-repository model
- Long-running tasks (potentially hours)
- Resource isolation and security
- Cost efficiency through resource sharing
- Auto-scaling capabilities
- WebSocket/SSH connectivity for real-time interaction

## AWS Container Service Options

### 1. Amazon ECS (Elastic Container Service) with Fargate
**Best for: Serverless container execution**

#### Pros:
- ✅ No EC2 instances to manage
- ✅ Pay only for resources used (vCPU/memory)
- ✅ Automatic scaling
- ✅ Built-in container orchestration
- ✅ Task definitions for easy container configuration
- ✅ Service discovery and load balancing
- ✅ Persistent tasks with "services"

#### Cons:
- ❌ More expensive than EC2 for long-running tasks
- ❌ Limited customization of underlying infrastructure
- ❌ Cold starts can be slower
- ❌ Network limitations for direct SSH access

#### Remote Claude Fit: 7/10
Good for isolation but expensive for long-running tasks.

### 2. Amazon ECS with EC2
**Best for: Container orchestration with infrastructure control**

#### Pros:
- ✅ Full control over EC2 instances
- ✅ Can use Spot instances for cost savings
- ✅ Container orchestration built-in
- ✅ Auto-scaling groups for instances
- ✅ Shared instances for multiple containers
- ✅ Direct SSH access to instances
- ✅ Persistent volumes with EBS

#### Cons:
- ❌ Need to manage EC2 instances
- ❌ More complex setup
- ❌ Overhead of ECS agent on each instance

#### Remote Claude Fit: 9/10
Excellent balance of control, cost, and container management.

### 3. Amazon EKS (Elastic Kubernetes Service)
**Best for: Kubernetes-native workloads**

#### Pros:
- ✅ Industry-standard Kubernetes
- ✅ Excellent for complex orchestration
- ✅ Rich ecosystem of tools
- ✅ Advanced scheduling and resource management
- ✅ StatefulSets for persistent workloads
- ✅ Horizontal pod autoscaling

#### Cons:
- ❌ Significant complexity overhead
- ❌ Higher operational cost
- ❌ Steeper learning curve
- ❌ Overkill for our use case

#### Remote Claude Fit: 6/10
Too complex for current needs but good for future scale.

### 4. AWS Batch
**Best for: Batch processing jobs**

#### Pros:
- ✅ Designed for long-running compute jobs
- ✅ Automatic resource provisioning
- ✅ Job queues and scheduling
- ✅ Spot instance integration
- ✅ Pay for what you use

#### Cons:
- ❌ Not designed for interactive workloads
- ❌ No real-time WebSocket support
- ❌ Job-oriented, not session-oriented
- ❌ Limited for our interactive use case

#### Remote Claude Fit: 4/10
Good for batch but not interactive sessions.

### 5. AWS App Runner
**Best for: Web applications**

#### Pros:
- ✅ Fully managed container service
- ✅ Automatic scaling
- ✅ Built-in load balancing
- ✅ Simple deployment

#### Cons:
- ❌ Designed for web apps, not long-running tasks
- ❌ Limited to HTTP workloads
- ❌ No SSH/WebSocket support for our use case
- ❌ Expensive for always-on workloads

#### Remote Claude Fit: 3/10
Not suitable for our use case.

### 6. Amazon Lightsail Containers
**Best for: Simple container deployments**

#### Pros:
- ✅ Simple pricing model
- ✅ Easy to use
- ✅ Includes load balancer
- ✅ Good for small-scale deployments

#### Cons:
- ❌ Limited scaling options
- ❌ Not suitable for complex orchestration
- ❌ Limited regions
- ❌ No spot instance support

#### Remote Claude Fit: 5/10
Too simple for our requirements.

## 🏆 Recommendation: ECS with EC2

Based on our requirements, **Amazon ECS with EC2** is the best choice for Remote Claude:

### Why ECS with EC2?

1. **Container Orchestration**: ECS handles container lifecycle, health checks, and placement
2. **Resource Efficiency**: Multiple containers share EC2 instances
3. **Cost Optimization**: Can use Spot instances for 60-90% savings
4. **Persistent Tasks**: ECS Services keep containers running
5. **Flexibility**: Full control over networking and storage
6. **Scaling**: Auto-scaling groups for instances, auto-scaling for tasks
7. **Integration**: Works well with ALB for WebSocket support

### Proposed Architecture with ECS

```
┌─────────────────────────────────────────────────┐
│                   ALB/NLB                       │
│         (WebSocket/SSH connections)             │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              ECS Cluster                        │
│  ┌─────────────────────────────────────────┐   │
│  │         ECS Service (per repo)          │   │
│  │  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │   Task 1    │  │   Task 2    │      │   │
│  │  │ (Container) │  │ (Container) │      │   │
│  │  └─────────────┘  └─────────────┘      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────────┐ ┌──────────────────┐    │
│  │  EC2 Instance 1  │ │  EC2 Instance 2  │    │
│  │  (Spot/OnDemand) │ │  (Spot/OnDemand) │    │
│  └──────────────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Implementation Plan with ECS

#### Phase 1: Basic ECS Setup
```typescript
// Task Definition
{
  family: "remote-claude-task",
  cpu: "1024",
  memory: "2048",
  networkMode: "awsvpc",
  containerDefinitions: [{
    name: "claude-code",
    image: "anthropic/claude-code:latest",
    essential: true,
    environment: [
      { name: "REPO_URL", value: "${REPO_URL}" },
      { name: "TASK_ID", value: "${TASK_ID}" }
    ],
    mountPoints: [{
      sourceVolume: "workspace",
      containerPath: "/workspace"
    }],
    portMappings: [{
      containerPort: 8080,
      protocol: "tcp"
    }]
  }],
  volumes: [{
    name: "workspace",
    efsVolumeConfiguration: {
      fileSystemId: "fs-12345678",
      rootDirectory: "/repos/${REPO_NAME}"
    }
  }]
}
```

#### Phase 2: Service Configuration
```typescript
// ECS Service per Repository
{
  serviceName: `claude-${repoName}`,
  cluster: "remote-claude",
  taskDefinition: "remote-claude-task:latest",
  desiredCount: 1,
  launchType: "EC2",
  networkConfiguration: {
    awsvpcConfiguration: {
      subnets: ["subnet-1", "subnet-2"],
      securityGroups: ["sg-claude-tasks"],
      assignPublicIp: "ENABLED"
    }
  },
  placementStrategies: [{
    type: "spread",
    field: "instanceId"
  }],
  enableExecuteCommand: true  // For SSH-like access
}
```

#### Phase 3: Auto-scaling Configuration
```yaml
# Instance Auto-scaling
TargetCapacity: 10
MinSize: 1
MaxSize: 50
TargetUtilization: 70%

# Task Auto-scaling
MinTasks: 0
MaxTasks: 5
ScaleUpCooldown: 60s
ScaleDownCooldown: 300s
```

### Cost Comparison

| Service | Setup Cost | Per Task/Hour | Long-running (24h) | Notes |
|---------|------------|---------------|-------------------|--------|
| EC2 (current) | Low | $0.10 | $2.40 | Manual management |
| ECS + EC2 | Medium | $0.08 | $1.92 | With container reuse |
| ECS + Fargate | Low | $0.20 | $4.80 | No management |
| EKS | High | $0.12 | $2.88 | Complex |

### Migration Path from Pure EC2

1. **Containerize properly**: Ensure Claude Code image is ECS-optimized
2. **Create ECS cluster**: Start with existing EC2 instances
3. **Define tasks**: Create task definitions for different workload types
4. **Implement service discovery**: Use AWS Cloud Map
5. **Add load balancing**: ALB for WebSocket support
6. **Enable auto-scaling**: Both instance and task level
7. **Monitor and optimize**: CloudWatch Container Insights

### Additional Benefits of ECS

1. **Built-in Health Checks**: Automatic container replacement
2. **Service Discovery**: Easy container-to-container communication
3. **IAM Integration**: Fine-grained permissions per task
4. **CloudWatch Integration**: Logs and metrics out of the box
5. **Blue/Green Deployments**: Safe updates with rollback
6. **Spot Instance Integration**: Automatic handling of interruptions

## Alternative: Hybrid Approach

Consider a hybrid approach for different workload types:
- **ECS + Fargate**: For short, bursty tasks
- **ECS + EC2**: For long-running repository containers
- **Lambda**: For webhook handlers and API endpoints
- **Batch**: For scheduled maintenance tasks

## Conclusion

While our current EC2 approach works, migrating to **ECS with EC2** provides:
- Better container orchestration
- Automatic scaling and health management
- Cost optimization through better resource utilization
- Simplified operations with AWS-managed orchestration
- Future-proof architecture that can scale

The container-per-repository model maps perfectly to ECS Services, and the persistent background execution requirement is handled natively by ECS.