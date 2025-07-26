const WebSocket = require('ws')

// Configuration
const AGENT_URL = 'ws://localhost:8080/?token=dev-token'

async function main() {
  console.log('Connecting to Remote Claude Agent...')
  
  const ws = new WebSocket(AGENT_URL)
  
  ws.on('open', () => {
    console.log('Connected!')
    
    // Create a terminal
    ws.send(JSON.stringify({
      type: 'terminal:create',
      payload: {}
    }))
  })
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString())
    console.log('Received:', message.type)
    
    switch (message.type) {
      case 'connected':
        console.log('Agent info:', message.payload)
        break
        
      case 'terminal:created':
        const { terminalId } = message.payload
        console.log('Terminal created:', terminalId)
        
        // Send a command
        ws.send(JSON.stringify({
          type: 'terminal:write',
          payload: {
            terminalId,
            data: 'echo "Hello from Remote Claude Agent!"\r\n'
          }
        }))
        
        // List files
        ws.send(JSON.stringify({
          type: 'fs:list',
          payload: {
            path: '/'
          }
        }))
        
        // Create Claude session
        ws.send(JSON.stringify({
          type: 'claude:create',
          payload: {}
        }))
        break
        
      case 'terminal:output':
        process.stdout.write(message.payload.data)
        break
        
      case 'fs:list:response':
        console.log('\nFiles in', message.payload.path + ':')
        message.payload.files.forEach(file => {
          console.log(`  ${file.type === 'directory' ? '[D]' : '[F]'} ${file.name}`)
        })
        break
        
      case 'claude:created':
        const { sessionId } = message.payload
        console.log('\nClaude session created:', sessionId)
        
        // Send a message to Claude
        ws.send(JSON.stringify({
          type: 'claude:message',
          payload: {
            sessionId,
            content: 'Hello Claude!'
          }
        }))
        break
        
      case 'claude:response':
        console.log('\nClaude says:', message.payload.message.content)
        
        // Close connection after Claude responds
        setTimeout(() => {
          console.log('\nClosing connection...')
          ws.close()
        }, 1000)
        break
        
      case 'error':
        console.error('Error:', message.payload)
        break
    }
  })
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
  
  ws.on('close', () => {
    console.log('Connection closed')
    process.exit(0)
  })
}

main().catch(console.error)