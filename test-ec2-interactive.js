#!/usr/bin/env node

/**
 * Test EC2 interactive session manually
 */

const { EC2Provider } = require('./dist/compute');

async function createInteractiveSession() {
  console.log('🧪 Creating EC2 Interactive Session\n');

  const config = {
    region: 'us-east-1',
    instanceType: 't3.micro',
    keyPair: 'remote-claude-test', // This is crucial!
    securityGroupIds: ['sg-0d7038b5c1245d0a3'],
    idleTimeout: 120, // 2 hours for interactive work
    autoTerminate: false, // Keep running for interactive use
    tags: {
      TestRun: 'interactive-session',
      Project: 'remote-claude',
      Purpose: 'interactive'
    }
  };

  console.log('🔧 Configuration:');
  console.log(`   Region: ${config.region}`);
  console.log(`   Instance Type: ${config.instanceType}`);
  console.log(`   Key Pair: ${config.keyPair} ✅`);
  console.log(`   Interactive Mode: Enabled`);

  const provider = new EC2Provider(config);
  let environment;

  try {
    console.log('\n🚀 Creating EC2 instance with SSH access...');
    
    environment = await provider.createEnvironment({
      name: `interactive-${Date.now()}`
    });
    
    console.log(`✅ Instance created: ${environment.id}`);
    console.log(`   Public IP: ${environment.metadata.publicIp}`);
    console.log(`   Status: ${environment.status}`);

    // Test SSH connection
    console.log('\n🔗 Testing SSH connection...');
    const testTask = {
      id: 'ssh-test',
      command: 'echo "SSH working!" && whoami && pwd && ls -la'
    };

    const execution = await provider.executeTask(environment, testTask);
    console.log(`✅ SSH connection successful!`);
    console.log(`   Output: ${execution.output?.substring(0, 200)}...`);

    // Show connection instructions
    console.log('\n📋 Interactive Session Ready!');
    console.log('─'.repeat(50));
    console.log(`Instance ID: ${environment.id}`);
    console.log(`Public IP: ${environment.metadata.publicIp}`);
    console.log(`SSH Command: ssh -i ~/.ssh/remote-claude-test.pem ec2-user@${environment.metadata.publicIp}`);
    console.log(`Remote Claude CLI: node dist/cli.js ec2 connect ${environment.id}`);
    console.log('─'.repeat(50));

    console.log('\n💡 What you can do:');
    console.log('• Connect via SSH for direct terminal access');
    console.log('• Run Claude Code commands directly');
    console.log('• Install additional tools and packages');
    console.log('• Work interactively for extended periods');
    
    console.log(`\n⚠️  Instance will auto-terminate after ${config.idleTimeout} minutes of inactivity`);
    console.log('💰 Estimated cost: ~$0.01/hour (t3.micro)');

    return environment;

  } catch (error) {
    console.error('\n❌ Failed to create interactive session:', error.message);
    
    if (environment) {
      console.log('🧹 Cleaning up failed instance...');
      try {
        await provider.destroyEnvironment(environment.id);
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
      }
    }
    
    throw error;
  }
}

async function main() {
  try {
    console.log('🎯 Creating EC2 Interactive Session for Remote Claude\n');
    
    const environment = await createInteractiveSession();
    
    console.log('\n🏁 Interactive session is ready!');
    console.log('Use the SSH command above to connect.');
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}