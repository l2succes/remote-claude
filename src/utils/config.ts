/**
 * Configuration utility for Remote Claude
 */

interface ConfigStore {
  [key: string]: any;
}

export class Config {
  private static store: ConfigStore = {};

  static initialize(config: ConfigStore): void {
    this.store = { ...this.store, ...config };
  }

  static get(key: string, defaultValue?: any): any {
    const keys = key.split('.');
    let value: any = this.store;
    
    for (const k of keys) {
      if (k && value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  static set(key: string, value: any): void {
    const keys = key.split('.');
    let current: any = this.store;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (k && (!(k in current) || typeof current[k] !== 'object')) {
        current[k] = {};
      }
      if (k) {
        current = current[k];
      }
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  static getAll(): ConfigStore {
    return { ...this.store };
  }
}

// Initialize with environment variables
Config.initialize({
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },
  ecs: {
    clusterName: process.env.ECS_CLUSTER_NAME || 'remote-claude',
    instanceType: process.env.ECS_INSTANCE_TYPE || 't3.medium',
    minInstances: parseInt(process.env.ECS_MIN_INSTANCES || '1'),
    maxInstances: parseInt(process.env.ECS_MAX_INSTANCES || '10'),
    enableSpot: process.env.ECS_ENABLE_SPOT === 'true',
    containerInsights: process.env.ECS_CONTAINER_INSIGHTS !== 'false',
    subnetIds: process.env.ECS_SUBNET_IDS?.split(',') || [],
    securityGroupIds: process.env.ECS_SECURITY_GROUP_IDS?.split(',') || [],
  },
  ec2: {
    shared: {
      minInstances: parseInt(process.env.EC2_SHARED_MIN_INSTANCES || '1'),
      maxInstances: parseInt(process.env.EC2_SHARED_MAX_INSTANCES || '5'),
      maxTasksPerInstance: parseInt(process.env.EC2_SHARED_MAX_TASKS_PER_INSTANCE || '10'),
      instanceType: process.env.EC2_SHARED_INSTANCE_TYPE || 't3.large',
    }
  },
  providers: {
    default: process.env.DEFAULT_PROVIDER || 'ecs-ec2',
    ecs: {
      enabled: process.env.PROVIDER_ECS_ENABLED !== 'false',
      config: {},
    },
    ec2Shared: {
      enabled: process.env.PROVIDER_EC2_SHARED_ENABLED !== 'false',
      config: {},
    },
    fly: {
      enabled: process.env.PROVIDER_FLY_ENABLED === 'true',
      config: {},
    },
    local: {
      enabled: process.env.PROVIDER_LOCAL_ENABLED === 'true',
      config: {},
    }
  }
});