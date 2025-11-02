/**
 * Interactive ACP Demo
 * Shows how to interact with the ACP system programmatically
 */

const { Agent, Message, Conversation, RequestResponseProtocol } = require('./dist/index.js');

async function runInteractiveDemo() {
  console.log('🎭 ACP Interactive Demo - Core Functionality\n');

  // 1. Create Agents
  console.log('1️⃣ Creating Agents...');
  
  const weatherAgent = new Agent({
    name: 'weather-service',
    description: 'Provides weather information',
    capabilities: ['weather-query', 'location-lookup'],
    endpoints: [{
      type: 'http',
      url: 'http://localhost:4001/weather',
      methods: ['POST']
    }],
    metadata: {
      version: '1.0.0',
      provider: 'WeatherCorp'
    }
  });

  const chatAgent = new Agent({
    name: 'chat-assistant',
    description: 'Conversational AI assistant',
    capabilities: ['natural-language', 'conversation'],
    endpoints: [{
      type: 'websocket',
      url: 'ws://localhost:4002/chat',
      methods: ['SEND']
    }],
    metadata: {
      version: '2.1.0',
      provider: 'ChatAI Inc'
    }
  });

  console.log(`✅ Weather Agent: ${weatherAgent.name} (${weatherAgent.id})`);
  console.log(`✅ Chat Agent: ${chatAgent.name} (${chatAgent.id})\n`);

  // 2. Create Messages
  console.log('2️⃣ Creating Messages...');

  const queryMessage = new Message({
    performative: 'query',
    sender: chatAgent.id,
    receiver: weatherAgent.id,
    content: {
      type: 'structured',
      data: {
        query: 'weather',
        location: 'New York',
        format: 'json'
      }
    },
    metadata: {
      timestamp: new Date().toISOString(),
      priority: 'high',
      timeout: 30000
    }
  });

  console.log(`✅ Query Message: ${queryMessage.id}`);
  console.log(`   Type: ${queryMessage.performative}`);
  console.log(`   From: ${queryMessage.sender}`);
  console.log(`   To: ${queryMessage.receiver}`);
  console.log(`   Content: ${JSON.stringify(queryMessage.content.data)}\n`);

  // 3. Create Response Message
  const responseMessage = queryMessage.createReply(
    {
      type: 'structured',
      data: {
        temperature: 60,
        condition: 'clear',
        humidity: 55,
        location: 'New York, NY'
      }
    },
    'inform',
    { sender: weatherAgent.id }
  );

  console.log(`✅ Response Message: ${responseMessage.id}`);
  console.log(`   Type: ${responseMessage.performative}`);
  console.log(`   In Reply To: ${responseMessage.inReplyTo}`);
  console.log(`   Content: ${JSON.stringify(responseMessage.content.data)}\n`);

  // 4. Create Conversation
  console.log('3️⃣ Creating Conversation...');

  const conversation = new Conversation({
    participants: [chatAgent.id, weatherAgent.id],
    initiator: chatAgent.id,
    metadata: {
      category: 'information-exchange',
      priority: 'normal',
      topic: 'Weather Information Request'
    }
  });

  // Add messages to conversation
  conversation.addMessage(queryMessage);
  conversation.addMessage(responseMessage);

  console.log(`✅ Conversation: ${conversation.id}`);
  console.log(`   Topic: ${conversation.metadata.topic}`);
  console.log(`   Initiator: ${conversation.initiator}`);
  console.log(`   Participants: ${conversation.participants.join(', ')}`);
  console.log(`   Messages: ${conversation.getMessages().length}\n`);

  // 5. Create Request-Response Protocol
  console.log('4️⃣ Setting up Request-Response Protocol...');

  const protocol = new RequestResponseProtocol({
    name: 'weather-query-protocol',
    description: 'Protocol for weather information requests',
    timeout: 30000,
    retries: 3
  });

  console.log(`✅ Protocol: ${protocol.name}`);
  console.log(`   Timeout: ${protocol.timeout}ms`);
  console.log(`   Max Retries: ${protocol.retries}\n`);

  // 6. Demonstrate Message Validation
  console.log('5️⃣ Message Validation...');

  try {
    // Valid message
    const validMessage = new Message({
      performative: 'request',
      sender: 'agent-1',
      receiver: 'agent-2',
      content: { type: 'text', data: 'Hello' }
    });
    console.log('✅ Valid message created successfully');

    // Invalid message (missing required fields)
    try {
      const invalidMessage = new Message({
        performative: '',
        sender: '',
        receiver: 'agent-2',
        content: { type: 'text', data: 'Hello' }
      });
    } catch (error) {
      console.log(`❌ Invalid message rejected: ${error.message}`);
    }
  } catch (error) {
    console.log(`❌ Validation error: ${error.message}`);
  }

  console.log();

  // 7. Show Agent Capabilities
  console.log('6️⃣ Agent Capabilities...');
  console.log(`Weather Agent capabilities: ${weatherAgent.capabilities.join(', ')}`);
  console.log(`Chat Agent capabilities: ${chatAgent.capabilities.join(', ')}\n`);

  // 8. Demonstrate Conversation History
  console.log('7️⃣ Conversation History...');
  const messages = conversation.getMessages();
  messages.forEach((msg, index) => {
    console.log(`   Message ${index + 1}: ${msg.performative} from ${msg.sender}`);
    console.log(`   Content: ${JSON.stringify(msg.content.data)}`);
  });

  console.log('\n🎯 ACP Core Features Demonstrated:');
  console.log('• Agent creation with capabilities and endpoints');
  console.log('• Message creation with different performatives');
  console.log('• Message reply functionality');
  console.log('• Conversation management');
  console.log('• Protocol definition');
  console.log('• Message validation');
  console.log('• Structured content handling');
  console.log('• Metadata support\n');

  console.log('📋 Message Performatives Available:');
  console.log('• request - Request for action');
  console.log('• inform - Information sharing');
  console.log('• query - Question asking');
  console.log('• confirm - Confirmation');
  console.log('• refuse - Refusal');
  console.log('• propose - Proposal');
  console.log('• accept - Acceptance');
  console.log('• reject - Rejection\n');

  console.log('🔄 Communication Flow:');
  console.log('1. Agents register with ACP server');
  console.log('2. Agent A discovers Agent B via registry');
  console.log('3. Agent A creates message with specific performative');
  console.log('4. Message is sent through ACP server');
  console.log('5. Agent B receives and processes message');
  console.log('6. Agent B creates reply message');
  console.log('7. Conversation tracks message history');
  console.log('8. Protocols ensure proper communication patterns\n');

  console.log('✨ Interactive demo completed!');
}

runInteractiveDemo().catch(console.error);