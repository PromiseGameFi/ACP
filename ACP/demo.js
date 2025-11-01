/**
 * ACP Demo Script
 * Demonstrates the Agent Communication Protocol server and functionality
 */

const { ACPServer, Agent, Message } = require('./dist/index.js');

async function runACPDemo() {
  console.log('🚀 Starting ACP (Agent Communication Protocol) Demo...\n');

  // Create and start the ACP server
  const server = new ACPServer({
    port: 3000,
    host: 'localhost',
    cors: true
  });

  console.log('📡 Starting ACP Server...');
  await server.start();
  console.log('✅ ACP Server is running on http://localhost:3000\n');

  // Create some demo agents
  console.log('🤖 Creating demo agents...');
  
  const agent1 = new Agent({
    name: 'assistant-agent',
    description: 'AI Assistant Agent',
    capabilities: ['text-processing', 'question-answering'],
    endpoints: [{
      type: 'http',
      url: 'http://localhost:3001/agent1',
      methods: ['POST']
    }]
  });

  const agent2 = new Agent({
    name: 'data-agent',
    description: 'Data Processing Agent',
    capabilities: ['data-analysis', 'file-processing'],
    endpoints: [{
      type: 'http',
      url: 'http://localhost:3002/agent2',
      methods: ['POST']
    }]
  });

  console.log(`✅ Created agent: ${agent1.name} (${agent1.id})`);
  console.log(`✅ Created agent: ${agent2.name} (${agent2.id})\n`);

  // Register agents with the server
  server.getAgents().set(agent1.id, agent1);
  server.getAgents().set(agent2.id, agent2);
  console.log('📝 Agents registered with ACP server\n');

  // Create a demo message
  console.log('💬 Creating demo message...');
  const message = new Message({
    performative: 'request',
    sender: agent1.id,
    receiver: agent2.id,
    content: {
      type: 'text',
      data: 'Hello! Can you help me process some data?'
    },
    metadata: {
      timestamp: new Date().toISOString(),
      priority: 'normal'
    }
  });

  console.log(`✅ Message created: ${message.id}`);
  console.log(`   From: ${message.sender}`);
  console.log(`   To: ${message.receiver}`);
  console.log(`   Content: ${message.content.data}\n`);

  // Display available API endpoints
  console.log('🌐 Available API Endpoints:');
  console.log('   GET  /health                     - Health check');
  console.log('   GET  /agents                     - List all agents');
  console.log('   POST /agents                     - Register new agent');
  console.log('   GET  /agents/:id                 - Get agent details');
  console.log('   POST /messages                   - Send message');
  console.log('   GET  /messages/:id               - Get message');
  console.log('   POST /conversations              - Create conversation');
  console.log('   GET  /conversations              - List conversations');
  console.log('   GET  /protocols                  - List protocols\n');

  console.log('🔗 Test the API:');
  console.log('   curl http://localhost:3000/health');
  console.log('   curl http://localhost:3000/agents');
  console.log('   curl http://localhost:3000/protocols\n');

  console.log('📚 How ACP Works:');
  console.log('1. Agents register with the ACP server');
  console.log('2. Agents can discover other agents via the registry');
  console.log('3. Agents communicate using standardized message formats');
  console.log('4. Messages follow performative types (request, inform, query, etc.)');
  console.log('5. Conversations can be created to group related messages');
  console.log('6. Protocols define communication patterns (request-response, etc.)\n');

  console.log('🎯 Key Features:');
  console.log('• Agent registration and discovery');
  console.log('• Standardized message format with metadata');
  console.log('• Conversation management');
  console.log('• Protocol support for different communication patterns');
  console.log('• RESTful API for integration');
  console.log('• WebSocket support for real-time communication');
  console.log('• Type-safe TypeScript implementation\n');

  console.log('✨ ACP Demo is running! Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down ACP Demo...');
  process.exit(0);
});

// Run the demo
runACPDemo().catch(console.error);