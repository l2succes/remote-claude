#!/usr/bin/env node

/**
 * Direct WebSocket test for the Agent Server
 */

const WebSocket = require('ws');

async function testQuery() {
  console.log('🔌 Connecting to ws://localhost:8080...');

  const ws = new WebSocket('ws://localhost:8080');

  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ Connected!');

      // Send a query
      const query = {
        id: `query-${Date.now()}`,
        type: 'query',
        timestamp: new Date().toISOString(),
        payload: {
          prompt: 'Hello! What tools do you have available? Please list them.',
          sessionId: `session-${Date.now()}`,
          options: {
            maxTurns: 5,
            allowedTools: ['Read', 'Write', 'Bash']
          }
        }
      };

      console.log('📤 Sending query...');
      ws.send(JSON.stringify(query));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'progress':
          console.log(`⏳ ${msg.payload.message}`);
          break;

        case 'response':
          const content = msg.payload.content;
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              console.log(block.text);
            }
          }
          break;

        case 'tool_use':
          console.log(`🔧 Using tool: ${msg.payload.toolName}`);
          break;

        case 'complete':
          console.log(`\n✅ Complete! Status: ${msg.payload.status}`);
          console.log(`📊 Turns: ${msg.payload.totalTurns}, Tokens: ${msg.payload.tokensUsed || 0}`);
          ws.close();
          resolve();
          break;

        case 'error':
          console.error(`❌ Error: ${msg.payload.message}`);
          ws.close();
          reject(new Error(msg.payload.message));
          break;
      }
    });

    ws.on('error', (err) => {
      console.error('❌ Connection error:', err.message);
      reject(err);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      console.error('⏱️ Timeout');
      ws.close();
      reject(new Error('Timeout'));
    }, 30000);
  });
}

// Test cloning a repo
async function testGitClone() {
  console.log('\n🔌 Testing Git Clone...');

  const ws = new WebSocket('ws://localhost:8080');

  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ Connected!');

      const query = {
        id: `query-${Date.now()}`,
        type: 'query',
        timestamp: new Date().toISOString(),
        payload: {
          prompt: 'Use git to clone https://github.com/sindresorhus/is-docker to /workspace/test-repo, then read the package.json and tell me what the package does.',
          sessionId: `session-${Date.now()}`,
          options: {
            maxTurns: 10,
            allowedTools: ['Read', 'Write', 'Bash', 'WebSearch']
          }
        }
      };

      console.log('📤 Sending git clone query...');
      ws.send(JSON.stringify(query));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'progress':
          console.log(`⏳ ${msg.payload.message}`);
          break;

        case 'response':
          const content = msg.payload.content;
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              console.log(block.text);
            }
          }
          break;

        case 'tool_use':
          console.log(`🔧 Using tool: ${msg.payload.toolName}`);
          break;

        case 'complete':
          console.log(`\n✅ Complete! Status: ${msg.payload.status}`);
          ws.close();
          resolve();
          break;

        case 'error':
          console.error(`❌ Error: ${msg.payload.message}`);
          ws.close();
          reject(new Error(msg.payload.message));
          break;
      }
    });

    ws.on('error', (err) => {
      console.error('❌ Connection error:', err.message);
      reject(err);
    });

    setTimeout(() => {
      console.error('⏱️ Timeout');
      ws.close();
      reject(new Error('Timeout'));
    }, 60000);
  });
}

// Run tests
async function main() {
  console.log('🧪 Testing Remote Claude Agent Server\n');

  try {
    // Test 1: Basic query
    await testQuery();

    // Test 2: Git clone
    await testGitClone();

    console.log('\n🎉 All tests passed!');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

main();