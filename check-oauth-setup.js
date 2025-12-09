#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function checkEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');

  // Check if .env exists
  if (!fs.existsSync(envPath)) {
    log('\n❌ .env file not found!', 'red');
    log('Creating .env from .env.example...', 'yellow');

    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      log('✅ .env file created', 'green');
      return false;
    } else {
      log('❌ .env.example not found!', 'red');
      process.exit(1);
    }
  }

  // Read .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  const config = {};
  lines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return config;
}

function validateOAuthConfig(config) {
  const required = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  const missing = [];
  const empty = [];

  required.forEach(key => {
    if (!config[key]) {
      missing.push(key);
    } else if (config[key] === '' || config[key] === 'your_client_id_here' || config[key] === 'your_client_secret_here') {
      empty.push(key);
    }
  });

  return { missing, empty, valid: missing.length === 0 && empty.length === 0 };
}

async function promptForCredentials() {
  return new Promise((resolve) => {
    log('\n📝 Let\'s set up your GitHub OAuth App credentials', 'cyan');
    log('\nFirst, you need to create a GitHub OAuth App:', 'yellow');
    log('1. Go to: https://github.com/settings/applications/new', 'blue');
    log('2. Fill in these details:', 'blue');
    log('   - Application name: Remote Claude Dev', 'blue');
    log('   - Homepage URL: http://localhost:3020', 'blue');
    log('   - Authorization callback URL: http://localhost:3020/api/github/callback', 'blue');
    log('3. Click "Register application"', 'blue');
    log('4. Copy the Client ID and generate a Client Secret', 'blue');

    log('\n✅ Once you have your credentials, press Enter to continue...', 'green');

    rl.question('', () => {
      rl.question('\n📋 Enter your GitHub Client ID: ', (clientId) => {
        rl.question('🔐 Enter your GitHub Client Secret: ', (clientSecret) => {
          resolve({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
        });
      });
    });
  });
}

function updateEnvFile(clientId, clientSecret) {
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update or add GITHUB_CLIENT_ID
  if (envContent.includes('GITHUB_CLIENT_ID=')) {
    envContent = envContent.replace(/GITHUB_CLIENT_ID=.*/g, `GITHUB_CLIENT_ID=${clientId}`);
  } else {
    envContent += `\nGITHUB_CLIENT_ID=${clientId}`;
  }

  // Update or add GITHUB_CLIENT_SECRET
  if (envContent.includes('GITHUB_CLIENT_SECRET=')) {
    envContent = envContent.replace(/GITHUB_CLIENT_SECRET=.*/g, `GITHUB_CLIENT_SECRET=${clientSecret}`);
  } else {
    envContent += `\nGITHUB_CLIENT_SECRET=${clientSecret}`;
  }

  // Ensure GITHUB_REDIRECT_URI is set
  if (!envContent.includes('GITHUB_REDIRECT_URI=')) {
    envContent += `\nGITHUB_REDIRECT_URI=http://localhost:3020/api/github/callback`;
  }

  fs.writeFileSync(envPath, envContent);
  log('\n✅ .env file updated successfully!', 'green');
}

async function main() {
  log('\n🔍 Checking GitHub OAuth Setup...', 'cyan');
  log('================================\n', 'cyan');

  const config = checkEnvFile();

  if (!config) {
    log('\n⚠️  Please configure your .env file with GitHub OAuth credentials', 'yellow');
    const { clientId, clientSecret } = await promptForCredentials();

    if (clientId && clientSecret) {
      updateEnvFile(clientId, clientSecret);
    } else {
      log('\n❌ No credentials provided. Exiting...', 'red');
      process.exit(1);
    }
  } else {
    const { missing, empty, valid } = validateOAuthConfig(config);

    if (valid) {
      log('✅ GitHub OAuth is configured!', 'green');
      log('\nYour configuration:', 'cyan');
      log(`  Client ID: ${config.GITHUB_CLIENT_ID.substring(0, 8)}...`, 'green');
      log(`  Client Secret: ****`, 'green');
      log(`  Redirect URI: ${config.GITHUB_REDIRECT_URI || 'http://localhost:3020/api/github/callback'}`, 'green');

      log('\n🚀 Next steps:', 'yellow');
      log('1. Restart your Next.js dev server (npm run dev)', 'blue');
      log('2. Go to http://localhost:3020/claude', 'blue');
      log('3. Click the GitHub button and login', 'blue');
    } else {
      if (missing.length > 0) {
        log(`\n❌ Missing configuration: ${missing.join(', ')}`, 'red');
      }
      if (empty.length > 0) {
        log(`\n⚠️  Empty or placeholder values: ${empty.join(', ')}`, 'yellow');
      }

      const { clientId, clientSecret } = await promptForCredentials();

      if (clientId && clientSecret) {
        updateEnvFile(clientId, clientSecret);
        log('\n🚀 Next steps:', 'yellow');
        log('1. Restart your Next.js dev server (npm run dev)', 'blue');
        log('2. Go to http://localhost:3020/claude', 'blue');
        log('3. Click the GitHub button and login', 'blue');
      } else {
        log('\n❌ No credentials provided. Exiting...', 'red');
        process.exit(1);
      }
    }
  }

  rl.close();
}

main().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});