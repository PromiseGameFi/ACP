/**
 * Tests for the Agent class
 */

import { Agent } from '../../src/core/agent';
import { Message } from '../../src/core/message';

describe('Agent', () => {
  const basicAgentOptions = {
    id: 'test-agent',
    name: 'Test Agent'
  };

  describe('constructor', () => {
    it('should create an agent with required fields', () => {
      const agent = new Agent(basicAgentOptions);
      
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.status).toBe('offline');
      expect(agent.capabilities).toEqual([]);
      expect(agent.endpoints).toEqual([]);
    });

    it('should create an agent with all optional fields', () => {
      const options = {
        ...basicAgentOptions,
        description: 'A test agent',
        capabilities: [],
        endpoints: []
      };
      
      const agent = new Agent(options);
      
      expect(agent.description).toBe('A test agent');
      expect(agent.capabilities).toEqual([]);
      expect(agent.endpoints).toEqual([]);
    });

    it('should throw error for missing name', () => {
      expect(() => {
        new Agent({
          ...basicAgentOptions,
          name: ''
        });
      }).toThrow('Agent name is required');
    });
  });

  describe('status management', () => {
    it('should set and get status', () => {
      const agent = new Agent(basicAgentOptions);
      
      agent.setStatus('online');
      expect(agent.status).toBe('online');
      
      agent.setStatus('busy');
      expect(agent.status).toBe('busy');
      
      agent.setStatus('offline');
      expect(agent.status).toBe('offline');
    });

    it('should emit status change event', (done) => {
      const agent = new Agent(basicAgentOptions);
      
      agent.on('statusChanged', (newStatus, oldStatus) => {
        expect(newStatus).toBe('online');
        expect(oldStatus).toBe('offline');
        done();
      });
      
      agent.setStatus('online');
    });

    it('should check status states', () => {
      const agent = new Agent(basicAgentOptions);
      
      expect(agent.status).toBe('offline');
      
      agent.setStatus('online');
      expect(agent.status).toBe('online');
      
      agent.setStatus('busy');
      expect(agent.status).toBe('busy');
    });
  });

  describe('capability management', () => {
    it('should add capabilities', () => {
      const agent = new Agent(basicAgentOptions);
      const capability = {
        name: 'search',
        description: 'Search capability',
        inputTypes: ['text'],
        outputTypes: ['text']
      };
      
      agent.addCapability(capability);
      
      expect(agent.hasCapability('search')).toBe(true);
    });

    it('should not add duplicate capabilities', () => {
      const agent = new Agent(basicAgentOptions);
      const capability = {
        name: 'chat',
        description: 'Chat capability',
        inputTypes: ['text'],
        outputTypes: ['text']
      };
      
      agent.addCapability(capability);
      agent.addCapability(capability);
      
      expect(agent.capabilities.filter(cap => cap.name === 'chat')).toHaveLength(1);
    });

    it('should remove capabilities', () => {
      const capabilities = [
        { name: 'chat', description: 'Chat capability', inputTypes: ['text'], outputTypes: ['text'] },
        { name: 'search', description: 'Search capability', inputTypes: ['text'], outputTypes: ['text'] },
        { name: 'translate', description: 'Translation capability', inputTypes: ['text'], outputTypes: ['text'] }
      ];
      
      const agent = new Agent({
        ...basicAgentOptions,
        capabilities
      });
      
      expect(agent.removeCapability('search')).toBe(true);
      expect(agent.hasCapability('search')).toBe(false);
    });

    it('should check if capability exists', () => {
      const capabilities = [
        { name: 'chat', description: 'Chat capability', inputTypes: ['text'], outputTypes: ['text'] },
        { name: 'search', description: 'Search capability', inputTypes: ['text'], outputTypes: ['text'] }
      ];
      
      const agent = new Agent({
        ...basicAgentOptions,
        capabilities
      });
      
      expect(agent.hasCapability('chat')).toBe(true);
      expect(agent.hasCapability('translate')).toBe(false);
    });

  });

  describe('endpoint management', () => {

    it('should have endpoints from constructor', () => {
      const endpoints = [
        { url: 'http://localhost:3000', type: 'http' as const },
        { url: 'ws://localhost:3001', type: 'websocket' as const }
      ];
      
      const agent = new Agent({
        ...basicAgentOptions,
        endpoints
      });
      
      expect(agent.endpoints).toEqual(endpoints);
    });
  });

  describe('message handling', () => {
    it('should handle incoming messages', async () => {
      const agent = new Agent(basicAgentOptions);
      const message = new Message({
        sender: 'other-agent',
        receiver: agent.id,
        performative: 'inform',
        content: 'Hello'
      });
      
      const handleSpy = jest.fn();
      agent.on('messageReceived', handleSpy);
      
      await agent.handleMessage(message);
      
      expect(handleSpy).toHaveBeenCalledWith(message);
    });

    it('should handle ping messages', async () => {
      const agent = new Agent(basicAgentOptions);
      const pingMessage = new Message({
        sender: 'other-agent',
        receiver: agent.id,
        performative: 'ping',
        content: null
      });
      
      const sendSpy = jest.spyOn(agent, 'sendMessage').mockResolvedValue(undefined);
      
      await agent.handleMessage(pingMessage);
      
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: agent.id,
          receiver: 'other-agent',
          performative: 'pong',
          inReplyTo: pingMessage.id
        })
      );
    });

    it('should handle query-ref messages', async () => {
      const agent = new Agent(basicAgentOptions);
      const queryMessage = new Message({
        sender: 'other-agent',
        receiver: agent.id,
        performative: 'query-ref',
        content: 'capabilities'
      });
      
      const sendSpy = jest.spyOn(agent, 'sendMessage').mockResolvedValue(undefined);
      
      await agent.handleMessage(queryMessage);
      
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: agent.id,
          receiver: 'other-agent',
          performative: 'inform',
          content: agent.capabilities,
          inReplyTo: queryMessage.id
        })
      );
    });

    it('should send messages', async () => {
      const agent = new Agent(basicAgentOptions);
      const message = new Message({
        sender: agent.id,
        receiver: 'other-agent',
        performative: 'inform',
        content: 'Hello'
      });
      
      const sendSpy = jest.fn();
      agent.on('messageSent', sendSpy);
      
      await agent.sendMessage(message);
      
      expect(sendSpy).toHaveBeenCalledWith(message);
    });

    it('should register message handlers', async () => {
      const agent = new Agent(basicAgentOptions);
      const customHandler = jest.fn();
      
      agent.onMessage('custom', customHandler);
      
      const message = new Message({
        sender: 'other-agent',
        receiver: agent.id,
        performative: 'custom',
        content: 'test'
      });
      
      await agent.handleMessage(message);
      
      expect(customHandler).toHaveBeenCalledWith(message);
    });
  });

  describe('protocol management', () => {
    it('should register protocol handlers', () => {
      const agent = new Agent(basicAgentOptions);
      const mockProtocol = {
        name: 'test-protocol',
        version: '1.0.0',
        handleMessage: jest.fn().mockResolvedValue(null),
        validateMessage: jest.fn().mockReturnValue(true),
        getStates: () => ['idle']
      };
      
      agent.registerProtocol(mockProtocol);
      
      expect(agent.protocols).toContain('test-protocol');
    });
  });

  describe('metadata management', () => {
    it('should convert to metadata object', () => {
      const agent = new Agent(basicAgentOptions);
      
      const metadata = agent.toMetadata();
      
      expect(metadata.id).toBe('test-agent');
      expect(metadata.name).toBe('Test Agent');
      expect(metadata.status).toBe('offline');
      expect(metadata.capabilities).toEqual([]);
      expect(metadata.endpoints).toEqual([]);
    });
  });

  describe('conversation management', () => {
    it('should get active conversations', () => {
      const agent = new Agent(basicAgentOptions);
      
      expect(agent.getActiveConversations()).toEqual([]);
    });

    it('should get conversation messages', () => {
      const agent = new Agent(basicAgentOptions);
      
      expect(agent.getConversationMessages('conv-1')).toEqual([]);
    });
  });
});