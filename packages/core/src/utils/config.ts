// Config utility
export const getConfig = () => {
  return {
    region: process.env.AWS_REGION || 'us-east-1',
    debug: process.env.DEBUG === 'true',
  };
};

// Config class for compatibility with existing code
export class Config {
  private static config: Record<string, any> = {};

  static get(key: string): any {
    // Parse dot notation
    const keys = key.split('.');
    let value: any = this.config;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    // Return environment variable fallback
    if (value === undefined) {
      // Map common config keys to env vars
      const envMap: Record<string, string> = {
        'aws.region': 'AWS_REGION',
        'ecs.clusterName': 'ECS_CLUSTER_NAME',
        'ecs.subnetIds': 'ECS_SUBNET_IDS',
        'ecs.securityGroupIds': 'ECS_SECURITY_GROUP_IDS',
        'ecs.instanceType': 'ECS_INSTANCE_TYPE',
        'ecs.minInstances': 'ECS_MIN_INSTANCES',
        'ecs.maxInstances': 'ECS_MAX_INSTANCES',
        'ecs.enableSpot': 'ECS_ENABLE_SPOT',
        'ecs.containerInsights': 'ECS_CONTAINER_INSIGHTS',
        'ec2.shared.minInstances': 'EC2_SHARED_MIN_INSTANCES',
        'ec2.shared.maxInstances': 'EC2_SHARED_MAX_INSTANCES',
        'ec2.shared.maxTasksPerInstance': 'EC2_SHARED_MAX_TASKS_PER_INSTANCE',
        'ec2.shared.instanceType': 'EC2_SHARED_INSTANCE_TYPE',
      };
      
      const envKey = envMap[key];
      if (envKey) {
        const envValue = process.env[envKey];
        if (envValue) {
          // Parse JSON arrays
          if (envValue.startsWith('[')) {
            try {
              return JSON.parse(envValue);
            } catch {
              return envValue;
            }
          }
          // Parse booleans
          if (envValue === 'true') return true;
          if (envValue === 'false') return false;
          // Parse numbers
          if (/^\d+$/.test(envValue)) return parseInt(envValue, 10);
          return envValue;
        }
      }
    }
    
    return value;
  }

  static set(key: string, value: any): void {
    const keys = key.split('.');
    let obj = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!obj[k]) {
        obj[k] = {};
      }
      obj = obj[k];
    }
    
    obj[keys[keys.length - 1]] = value;
  }
}