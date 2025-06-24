#!/usr/bin/env node

/**
 * Helper script to set up secure Git access for EC2 instances
 * 
 * Usage:
 *   node setup-git-access.js <instance-id> [options]
 * 
 * Options:
 *   --deploy-key <path>     Path to deploy key file
 *   --git-name <name>       Git user name
 *   --git-email <email>     Git user email
 *   --repos <repo1,repo2>   Repositories to clone
 */

const { EC2Provider } = require('./dist/compute');
const fs = require('fs').promises;

async function setupGitAccess() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔐 Set up secure Git access for EC2 instances

Usage: node setup-git-access.js <instance-id> [options]

Options:
  --deploy-key <path>     Path to deploy key file (recommended)
  --git-name <name>       Git user name
  --git-email <email>     Git user email  
  --repos <repo1,repo2>   Repositories to clone

Examples:
  # Set up deploy key and clone repos
  node setup-git-access.js i-xxx --deploy-key ~/.ssh/deploy_key --repos owner/repo1,owner/repo2
  
  # Just configure Git user
  node setup-git-access.js i-xxx --git-name "Your Name" --git-email "you@example.com"

Security Notes:
  • Deploy keys are safest - create read-only keys per repository
  • SSH agent forwarding works for interactive sessions: rclaude ec2 connect i-xxx -A
  • Never use personal SSH keys on instances
    `);
    process.exit(1);
  }

  const instanceId = args[0];
  const options = {};

  // Parse arguments
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--deploy-key':
        options.deployKey = value;
        break;
      case '--git-name':
        options.gitConfig = { ...options.gitConfig, name: value };
        break;
      case '--git-email':
        options.gitConfig = { ...options.gitConfig, email: value };
        break;
      case '--repos':
        options.repositories = value.split(',');
        break;
    }
  }

  try {
    console.log(`🔐 Setting up Git access for instance ${instanceId}...`);

    // Get EC2 provider configuration
    const { ConfigManager } = require('./dist/cli/utils/config');
    const configManager = new ConfigManager();
    const ec2Config = configManager.get('ec2') || {};
    
    const providerConfig = {
      region: ec2Config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      instanceType: ec2Config.instanceType || 't3.micro',
      ...ec2Config
    };

    const provider = new EC2Provider(providerConfig);
    
    // Get environment details
    const environments = await provider.listEnvironments();
    const environment = environments.find(env => env.id === instanceId);
    
    if (!environment) {
      console.error(`❌ Instance ${instanceId} not found`);
      process.exit(1);
    }

    if (environment.status !== 'running') {
      console.error(`❌ Instance ${instanceId} is not running (status: ${environment.status})`);
      process.exit(1);
    }

    // Validate deploy key exists
    if (options.deployKey) {
      try {
        await fs.access(options.deployKey);
        console.log(`✅ Deploy key found: ${options.deployKey}`);
      } catch {
        console.error(`❌ Deploy key not found: ${options.deployKey}`);
        process.exit(1);
      }
    }

    // Set up Git access
    await provider.setupGitAccess(environment, options);
    
    console.log(`✅ Git access configured for instance ${instanceId}`);
    
    if (options.deployKey) {
      console.log('\n📋 Deploy Key Setup Complete');
      console.log('• Private repositories can now be cloned via SSH');
      console.log('• Deploy key is stored securely on the instance');
      console.log('• Key has read-only access to specified repositories');
    }
    
    if (options.repositories) {
      console.log(`\n📦 Cloned ${options.repositories.length} repositories`);
    }
    
    console.log('\n💡 Next steps:');
    console.log(`• Connect: rclaude ec2 connect ${instanceId}`);
    console.log(`• Clone more repos: git clone git@github.com:owner/repo.git`);
    console.log(`• For interactive Git: rclaude ec2 connect ${instanceId} -A`);
    console.log(`• Copy SSH keys: rclaude ec2 copy-ssh-key ${instanceId} --setup-github`);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupGitAccess().catch(console.error);
}