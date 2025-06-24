#!/usr/bin/env node

/**
 * Simple EC2Provider test with minimal interaction
 */

const { EC2Provider } = require('./dist/compute');

async function simpleTest() {
  console.log('🧪 Remote Claude EC2 Provider - Simple Instance Test\n');
  
  const config = {
    region: 'us-east-1',
    instanceType: 't3.micro', // Free tier eligible
    keyPair: 'remote-claude-test',
    securityGroupIds: ['sg-0d7038b5c1245d0a3'], // Default security group
    idleTimeout: 30,
    autoTerminate: true,
    tags: {
      TestRun: 'simple-test',
      Project: 'remote-claude'
    }
  };

  console.log('🔧 Configuration:');
  console.log(`   Region: ${config.region}`);
  console.log(`   Instance Type: ${config.instanceType}`);
  console.log(`   Key Pair: ${config.keyPair}`);
  console.log(`   Security Group: ${config.securityGroupIds[0]}`);

  const provider = new EC2Provider(config);
  let environment;
  const startTime = Date.now();

  try {
    console.log('\n🚀 Creating EC2 instance...');
    console.log('   (This takes 2-4 minutes - please wait)');
    
    environment = await provider.createEnvironment({
      name: `simple-test-${Date.now()}`
    });
    
    const createTime = (Date.now() - startTime) / 1000;
    console.log(`✅ Instance created in ${createTime.toFixed(1)}s`);
    console.log(`   Instance ID: ${environment.id}`);
    console.log(`   Status: ${environment.status}`);
    console.log(`   Public IP: ${environment.metadata.publicIp || 'pending'}`);

    // Wait a bit for SSH to be ready
    console.log('\n⏱️  Waiting for SSH to be ready...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test simple command execution
    console.log('\n🔨 Testing command execution...');
    const simpleTask = {
      id: 'test-1',
      command: 'echo "Hello from EC2!" && whoami && date && uptime'
    };

    const execution = await provider.executeTask(environment, simpleTask);
    console.log(`✅ Task completed: ${execution.status}`);
    console.log(`   Exit Code: ${execution.exitCode}`);
    console.log(`   Output Preview: ${execution.output?.substring(0, 150)}...`);

    // Test file upload
    console.log('\n📁 Testing file operations...');
    await provider.uploadFiles(environment.id, {
      '/tmp/test.txt': 'Hello from Remote Claude!'
    });
    console.log('✅ File uploaded successfully');

    // Download the file
    const files = await provider.downloadResults(environment.id, ['/tmp/test.txt']);
    console.log(`✅ File downloaded: ${files['/tmp/test.txt']}`);

    // Performance summary
    const totalTime = (Date.now() - startTime) / 1000;
    console.log('\n🎉 Test completed successfully!');
    console.log(`   Total Time: ${totalTime.toFixed(1)}s`);
    console.log(`   Estimated Cost: $${((totalTime / 3600) * 0.0104).toFixed(4)}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('InvalidKeyPair')) {
      console.error('💡 Key pair issue - make sure remote-claude-test exists');
    } else if (error.message.includes('InvalidGroup')) {
      console.error('💡 Security group issue - check permissions');
    } else if (error.message.includes('UnauthorizedOperation')) {
      console.error('💡 Permission issue - check IAM permissions');
    }
    
    throw error;
  } finally {
    if (environment) {
      console.log('\n🧹 Cleaning up instance...');
      try {
        await provider.destroyEnvironment(environment.id);
        console.log('✅ Instance terminated successfully');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
        console.error(`⚠️  Manual cleanup: aws ec2 terminate-instances --instance-ids ${environment.id}`);
      }
    }
  }
}

async function main() {
  try {
    console.log('⚠️  This will create a real EC2 instance (cost: ~$0.01-0.02)');
    console.log('⚠️  The instance will be automatically terminated when done\n');
    
    await simpleTest();
    console.log('\n🏁 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}