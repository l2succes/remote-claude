#!/usr/bin/env node

/**
 * Basic EC2Provider validation script
 * Tests core functionality without requiring full task execution
 */

const { EC2Provider } = require('./dist/compute');

async function validateBasicSetup() {
  console.log('🧪 Remote Claude EC2 Provider - Basic Validation\n');
  
  // Test 1: Provider initialization
  console.log('1️⃣ Testing provider initialization...');
  try {
    const config = {
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      instanceType: 't3.micro',
      keyPair: process.env.EC2_KEY_PAIR || 'remote-claude-test',
      idleTimeout: 30,
      autoTerminate: true,
      tags: {
        TestRun: 'basic-validation',
        Project: 'remote-claude'
      }
    };

    const provider = new EC2Provider(config);
    console.log('✅ Provider created successfully');
    console.log(`   Name: ${provider.name}`);
    console.log(`   Type: ${provider.type}`);
    
    // Test 2: Configuration validation
    console.log('\n2️⃣ Testing configuration validation...');
    const validation = await provider.validateConfig(config);
    console.log(`✅ Configuration validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
    if (validation.errors.length > 0) {
      console.log('   Errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.log('   Warnings:', validation.warnings);
    }

    // Test 3: Provider capabilities
    console.log('\n3️⃣ Testing provider capabilities...');
    const capabilities = provider.getCapabilities();
    console.log('✅ Capabilities retrieved:');
    console.log(`   Spot Instances: ${capabilities.supportsSpotInstances}`);
    console.log(`   Persistent Storage: ${capabilities.supportsPersistentStorage}`);
    console.log(`   Custom Images: ${capabilities.supportsCustomImages}`);
    console.log(`   Docker Containers: ${capabilities.supportsDockerContainers}`);
    console.log(`   Max Concurrent Tasks: ${capabilities.maxConcurrentTasks}`);

    // Test 4: AWS credentials check
    console.log('\n4️⃣ Testing AWS credentials...');
    try {
      // Try to list existing instances to verify credentials
      const environments = await provider.listEnvironments();
      console.log(`✅ AWS credentials working - found ${environments.length} existing Remote Claude instances`);
      
      if (environments.length > 0) {
        console.log('   Existing instances:');
        environments.forEach(env => {
          console.log(`   - ${env.id} (${env.status}) - ${env.metadata.displayName || 'unnamed'}`);
        });
      }
    } catch (error) {
      console.log('❌ AWS credentials issue:', error.message);
      console.log('   Make sure you have configured AWS credentials:');
      console.log('   - Run: aws configure');
      console.log('   - Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
      return false;
    }

    console.log('\n✅ Basic validation completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Ensure you have an EC2 key pair created');
    console.log('2. Configure security group and subnet (see docs/ec2-testing-guide.md)');
    console.log('3. Run: node test-ec2-instance.js for full instance testing');
    
    return true;

  } catch (error) {
    console.error('❌ Basic validation failed:', error.message);
    console.error('\nDebugging tips:');
    console.error('- Check your AWS credentials: aws sts get-caller-identity');
    console.error('- Verify IAM permissions for EC2 operations');
    console.error('- Check your default region: aws configure get region');
    return false;
  }
}

// Test invalid configuration
async function testInvalidConfig() {
  console.log('\n🧪 Testing configuration validation with invalid inputs...');
  
  const provider = new EC2Provider({
    region: 'us-east-1',
    instanceType: 't3.micro'
  });

  const tests = [
    { region: '', instanceType: 't3.micro', description: 'empty region' },
    { region: 'us-east-1', instanceType: '', description: 'empty instance type' },
    { region: 'invalid-region', instanceType: 't3.micro', description: 'invalid region format' },
    { region: 'us-east-1', instanceType: 'invalid-type', description: 'invalid instance type format' },
    { region: 'us-east-1', instanceType: 't3.micro', idleTimeout: 5, description: 'very short idle timeout' },
    { region: 'us-east-1', instanceType: 't3.micro', spotInstance: true, description: 'spot instance warning' }
  ];

  for (const test of tests) {
    const result = await provider.validateConfig(test);
    const status = test.description.includes('warning') ? 
      (result.warnings.length > 0 ? '✅' : '❌') :
      (!result.valid ? '✅' : '❌');
    console.log(`${status} ${test.description}: ${result.valid ? 'valid' : 'invalid'} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
  }
}

// Main execution
async function main() {
  const basicSuccess = await validateBasicSetup();
  
  if (basicSuccess) {
    await testInvalidConfig();
  }
  
  console.log('\n📋 Summary:');
  console.log('- Basic provider functionality: ' + (basicSuccess ? '✅ WORKING' : '❌ FAILED'));
  console.log('- Ready for instance testing: ' + (basicSuccess ? '✅ YES' : '❌ NO'));
  
  if (!basicSuccess) {
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Install and configure AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html');
    console.log('2. Create IAM user with EC2 permissions');
    console.log('3. Run: aws configure');
    console.log('4. Test: aws ec2 describe-regions');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateBasicSetup };