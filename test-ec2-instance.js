#!/usr/bin/env node

/**
 * EC2Provider instance testing script
 * Tests full instance lifecycle and task execution
 */

const { EC2Provider } = require('./dist/compute');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function testInstanceLifecycle() {
  console.log('🧪 Remote Claude EC2 Provider - Instance Lifecycle Test\n');

  // Get configuration from user
  console.log('📋 Configuration Setup:');
  const region = await askQuestion(`AWS Region [${process.env.AWS_DEFAULT_REGION || 'us-east-1'}]: `) || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const instanceType = await askQuestion('Instance Type [t3.micro]: ') || 't3.micro';
  const keyPair = await askQuestion('EC2 Key Pair Name: ');
  
  if (!keyPair) {
    console.log('❌ EC2 Key Pair is required for SSH access');
    console.log('Create one with: aws ec2 create-key-pair --key-name my-key');
    rl.close();
    return;
  }

  let securityGroupId = await askQuestion('Security Group ID (optional): ');
  let subnetId = await askQuestion('Subnet ID (optional): ');

  // If no security group provided, we'll use default VPC
  if (!securityGroupId) {
    console.log('ℹ️  No security group specified, will use default VPC');
  }

  const config = {
    region,
    instanceType,
    keyPair,
    ...(securityGroupId && { securityGroupIds: [securityGroupId] }),
    ...(subnetId && { subnetId }),
    idleTimeout: 60, // 1 hour for testing
    autoTerminate: true,
    tags: {
      TestRun: 'instance-lifecycle-test',
      Project: 'remote-claude',
      CreatedBy: 'test-script'
    }
  };

  console.log('\n🔧 Configuration:');
  console.log(JSON.stringify(config, null, 2));

  const proceed = await askQuestion('\nProceed with instance creation? (y/N): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('Test cancelled by user');
    rl.close();
    return;
  }

  rl.close();

  const provider = new EC2Provider(config);
  let environment;
  let startTime = Date.now();

  try {
    // Phase 1: Instance Creation
    console.log('\n🚀 Phase 1: Creating EC2 instance...');
    console.log('⏱️  This typically takes 2-4 minutes...');
    
    environment = await provider.createEnvironment({
      name: `test-env-${Date.now()}`
    });
    
    const createTime = (Date.now() - startTime) / 1000;
    console.log(`✅ Instance created in ${createTime.toFixed(1)}s`);
    console.log(`   Instance ID: ${environment.id}`);
    console.log(`   Status: ${environment.status}`);
    console.log(`   Public IP: ${environment.metadata.publicIp || 'pending'}`);
    console.log(`   Private IP: ${environment.metadata.privateIp || 'pending'}`);

    // Phase 2: Status Monitoring
    console.log('\n📊 Phase 2: Status monitoring...');
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
      const status = await provider.getEnvironmentStatus(environment.id);
      console.log(`   Status check ${i + 1}: ${status}`);
    }

    // Phase 3: Simple Task Execution
    console.log('\n🔨 Phase 3: Testing task execution...');
    
    const simpleTask = {
      id: 'test-simple',
      command: 'echo "Hello from EC2!" && whoami && pwd && date'
    };

    startTime = Date.now();
    console.log('⏱️  Executing simple command...');
    const execution1 = await provider.executeTask(environment, simpleTask);
    const execTime1 = (Date.now() - startTime) / 1000;
    
    console.log(`✅ Simple task completed in ${execTime1.toFixed(1)}s`);
    console.log(`   Status: ${execution1.status}`);
    console.log(`   Exit Code: ${execution1.exitCode}`);
    console.log(`   Output: ${execution1.output?.substring(0, 200)}${execution1.output?.length > 200 ? '...' : ''}`);

    // Phase 4: File Operations
    console.log('\n📁 Phase 4: Testing file operations...');
    
    const testFiles = {
      '/tmp/test.txt': 'Hello from Remote Claude!\nThis is a test file.',
      '/tmp/config.json': JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        hostname: 'test-instance'
      }, null, 2)
    };

    console.log('📤 Uploading test files...');
    await provider.uploadFiles(environment.id, testFiles);
    console.log('✅ Files uploaded successfully');

    console.log('📥 Downloading files...');
    const downloadedFiles = await provider.downloadResults(environment.id, [
      '/tmp/test.txt',
      '/tmp/config.json',
      '/etc/os-release' // System file
    ]);
    
    console.log('✅ Files downloaded:');
    Object.entries(downloadedFiles).forEach(([path, content]) => {
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      console.log(`   ${path}: ${preview}`);
    });

    // Phase 5: Claude Code Installation Test
    console.log('\n🤖 Phase 5: Testing Claude Code installation...');
    
    const claudeTask = {
      id: 'test-claude',
      command: 'which claude && claude --version'
    };

    startTime = Date.now();
    const execution2 = await provider.executeTask(environment, claudeTask);
    const execTime2 = (Date.now() - startTime) / 1000;
    
    console.log(`✅ Claude Code test completed in ${execTime2.toFixed(1)}s`);
    console.log(`   Status: ${execution2.status}`);
    console.log(`   Exit Code: ${execution2.exitCode}`);
    console.log(`   Output: ${execution2.output}`);

    // Phase 6: Environment Listing
    console.log('\n📋 Phase 6: Testing environment listing...');
    const environments = await provider.listEnvironments();
    console.log(`✅ Found ${environments.length} Remote Claude environments:`);
    environments.forEach(env => {
      console.log(`   - ${env.id} (${env.status}) - ${env.metadata.displayName || 'unnamed'}`);
    });

    // Success Summary
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Performance Summary:');
    console.log(`   Instance Creation: ${createTime.toFixed(1)}s`);
    console.log(`   Simple Task: ${execTime1.toFixed(1)}s`);
    console.log(`   Claude Code Task: ${execTime2.toFixed(1)}s`);
    
    console.log('\n💰 Cost Estimate:');
    const runtimeMinutes = (Date.now() - startTime) / 60000;
    const costPerHour = instanceType === 't3.micro' ? 0.0104 : 
                       instanceType === 't3.small' ? 0.0208 :
                       instanceType === 't3.medium' ? 0.0416 : 0.05;
    const estimatedCost = (runtimeMinutes / 60) * costPerHour;
    console.log(`   Runtime: ${runtimeMinutes.toFixed(1)} minutes`);
    console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Common error troubleshooting
    if (error.message.includes('InvalidKeyPair')) {
      console.error('\n🔧 Key Pair Issue:');
      console.error('- Verify key pair exists: aws ec2 describe-key-pairs');
      console.error('- Create new key pair: aws ec2 create-key-pair --key-name my-key');
    } else if (error.message.includes('InvalidGroup')) {
      console.error('\n🔧 Security Group Issue:');
      console.error('- Verify security group exists: aws ec2 describe-security-groups');
      console.error('- Use default VPC by omitting security group ID');
    } else if (error.message.includes('InvalidSubnet')) {
      console.error('\n🔧 Subnet Issue:');
      console.error('- Verify subnet exists: aws ec2 describe-subnets');
      console.error('- Use default VPC by omitting subnet ID');
    } else if (error.message.includes('UnauthorizedOperation')) {
      console.error('\n🔧 Permission Issue:');
      console.error('- Check IAM permissions for EC2 operations');
      console.error('- Verify AWS credentials: aws sts get-caller-identity');
    }
  } finally {
    // Cleanup
    if (environment) {
      console.log('\n🧹 Cleaning up instance...');
      try {
        await provider.destroyEnvironment(environment.id);
        console.log('✅ Instance terminated successfully');
        
        // Wait a bit and verify termination
        await new Promise(resolve => setTimeout(resolve, 10000));
        const finalStatus = await provider.getEnvironmentStatus(environment.id);
        console.log(`   Final status: ${finalStatus}`);
        
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
        console.error(`⚠️  Manual cleanup required for instance: ${environment.id}`);
        console.error(`   Run: aws ec2 terminate-instances --instance-ids ${environment.id}`);
      }
    }
    
    console.log('\n🏁 Test script completed');
  }
}

// Security check before running
async function securityCheck() {
  console.log('🔒 Security Check:');
  console.log('This script will:');
  console.log('- Create an EC2 instance in your AWS account');
  console.log('- Install software on the instance');
  console.log('- Execute commands via SSH');
  console.log('- Automatically terminate the instance when done');
  console.log('- Estimated cost: $0.01 - $0.05 for testing');
  console.log('');
  
  const confirm = await askQuestion('Do you understand and consent to these actions? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Security check failed. Exiting.');
    rl.close();
    process.exit(0);
  }
}

async function main() {
  try {
    // First run basic validation
    const { validateBasicSetup } = require('./test-ec2-basic.js');
    const basicValid = await validateBasicSetup();
    
    if (!basicValid) {
      console.log('\n❌ Basic validation failed. Please fix issues before running instance tests.');
      process.exit(1);
    }
    
    console.log('\n' + '='.repeat(60));
    await securityCheck();
    await testInstanceLifecycle();
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}