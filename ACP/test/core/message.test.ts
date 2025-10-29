/**
 * Tests for the Message class
 */

import { Message } from '../../src/core/message';

describe('Message', () => {
  const basicMessageOptions = {
    sender: 'agent1',
    receiver: 'agent2',
    performative: 'inform',
    content: 'Hello, World!'
  };

  describe('constructor', () => {
    it('should create a message with required fields', () => {
      const message = new Message(basicMessageOptions);
      
      expect(message.sender).toBe('agent1');
      expect(message.receiver).toBe('agent2');
      expect(message.performative).toBe('inform');
      expect(message.content).toBe('Hello, World!');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    it('should create a message with custom ID', () => {
      const customId = 'custom-message-id';
      const message = new Message({
        ...basicMessageOptions,
        id: customId
      });
      
      expect(message.id).toBe(customId);
    });

    it('should create a message with conversation ID', () => {
      const conversationId = 'conv-123';
      const message = new Message({
        ...basicMessageOptions,
        conversationId
      });
      
      expect(message.conversationId).toBe(conversationId);
    });

    it('should create a message with reply reference', () => {
      const inReplyTo = 'original-message-id';
      const message = new Message({
        ...basicMessageOptions,
        inReplyTo
      });
      
      expect(message.inReplyTo).toBe(inReplyTo);
    });

    it('should create a message with metadata', () => {
      const metadata = { priority: 'high', category: 'urgent' };
      const message = new Message({
        ...basicMessageOptions,
        metadata
      });
      
      expect(message.metadata).toEqual(metadata);
    });

    it('should throw error for missing sender', () => {
      expect(() => {
        new Message({
          ...basicMessageOptions,
          sender: ''
        });
      }).toThrow('Sender is required');
    });

    it('should throw error for missing receiver', () => {
      expect(() => {
        new Message({
          ...basicMessageOptions,
          receiver: ''
        });
      }).toThrow('Receiver is required');
    });

    it('should throw error for missing performative', () => {
      expect(() => {
        new Message({
          ...basicMessageOptions,
          performative: ''
        });
      }).toThrow('Performative is required');
    });
  });

  describe('validation', () => {
    it('should validate message with all required fields', () => {
      const message = new Message(basicMessageOptions);
      expect(message.sender).toBe('agent1');
      expect(message.receiver).toBe('agent2');
      expect(message.performative).toBe('inform');
    });

    it('should throw error for empty sender', () => {
      expect(() => {
        new Message({
          ...basicMessageOptions,
          sender: ''
        });
      }).toThrow('Sender is required');
    });

    it('should throw error for empty receiver', () => {
      expect(() => {
        new Message({
          ...basicMessageOptions,
          receiver: ''
        });
      }).toThrow('Receiver is required');
    });

    it('should throw error for empty performative', () => {
      expect(() => {
        new Message({
          ...basicMessageOptions,
          performative: ''
        });
      }).toThrow('Performative is required');
    });
  });

  describe('reply functionality', () => {
    it('should create a reply message', () => {
      const originalMessage = new Message(basicMessageOptions);
      const replyContent = 'This is a reply';
      
      const reply = originalMessage.createReply(replyContent, 'inform', { sender: 'agent2' });
      
      expect(reply.sender).toBe('agent2');
      expect(reply.receiver).toBe('agent1');
      expect(reply.content).toBe(replyContent);
      expect(reply.inReplyTo).toBe(originalMessage.id);
      expect(reply.conversationId).toBe(originalMessage.conversationId);
    });

    it('should create a reply with custom performative', () => {
      const originalMessage = new Message(basicMessageOptions);
      const reply = originalMessage.createReply('Reply content', 'confirm', { sender: 'agent2' });
      
      expect(reply.performative).toBe('confirm');
    });

    it('should check if message is a reply', () => {
      const originalMessage = new Message(basicMessageOptions);
      const reply = originalMessage.createReply('Reply', 'inform', { sender: 'agent2' });
      
      expect(originalMessage.isReply()).toBe(false);
      expect(reply.isReply()).toBe(true);
    });

    it('should check if message is reply to specific message', () => {
      const originalMessage = new Message(basicMessageOptions);
      const reply = originalMessage.createReply('Reply', 'inform', { sender: 'agent2' });
      const otherMessage = new Message({
        ...basicMessageOptions,
        sender: 'agent3'
      });
      
      expect(reply.isReplyTo(originalMessage.id)).toBe(true);
      expect(reply.isReplyTo(otherMessage.id)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to object', () => {
      const message = new Message({
        ...basicMessageOptions,
        conversationId: 'conv-123',
        inReplyTo: 'msg-456',
        metadata: { priority: 'high' }
      });
      
      const obj = message.toObject();
      
      expect(obj).toEqual({
        id: message.id,
        sender: 'agent1',
        receiver: 'agent2',
        performative: 'inform',
        content: 'Hello, World!',
        conversationId: 'conv-123',
        inReplyTo: 'msg-456',
        timestamp: message.timestamp,
        metadata: { priority: 'high' }
      });
    });

    it('should convert to JSON string', () => {
      const message = new Message(basicMessageOptions);
      const jsonString = message.toJSON();
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.sender).toBe('agent1');
      expect(parsed.receiver).toBe('agent2');
      expect(parsed.performative).toBe('inform');
      expect(parsed.content).toBe('Hello, World!');
    });

    it('should create message from object', () => {
      const messageObj = {
        id: 'test-id',
        sender: 'agent1',
        receiver: 'agent2',
        performative: 'inform',
        content: 'Test content',
        conversationId: 'conv-123',
        timestamp: Date.now(),
        metadata: { test: true }
      };
      
      const message = Message.fromObject(messageObj);
      
      expect(message.id).toBe('test-id');
      expect(message.sender).toBe('agent1');
      expect(message.receiver).toBe('agent2');
      expect(message.performative).toBe('inform');
      expect(message.content).toBe('Test content');
      expect(message.conversationId).toBe('conv-123');
      expect(message.metadata).toEqual({ test: true });
    });

    it('should create message from JSON string', () => {
      const messageObj = {
        sender: 'agent1',
        receiver: 'agent2',
        performative: 'inform',
        content: 'Test content'
      };
      
      const jsonString = JSON.stringify(messageObj);
      const message = Message.fromJSON(jsonString);
      
      expect(message.sender).toBe('agent1');
      expect(message.receiver).toBe('agent2');
      expect(message.performative).toBe('inform');
      expect(message.content).toBe('Test content');
    });
  });

  describe('metadata management', () => {
    it('should handle metadata in constructor', () => {
      const metadata = { priority: 'high', category: 'urgent' };
      const message = new Message({
        ...basicMessageOptions,
        metadata
      });
      
      expect(message.metadata).toEqual(metadata);
      expect(message.metadata?.priority).toBe('high');
      expect(message.metadata?.category).toBe('urgent');
    });

    it('should handle undefined metadata', () => {
      const message = new Message(basicMessageOptions);
      
      expect(message.metadata).toBeUndefined();
    });

    it('should handle empty metadata object', () => {
      const message = new Message({
        ...basicMessageOptions,
        metadata: {}
      });
      
      expect(message.metadata).toEqual({});
    });

    it('should preserve metadata in toObject', () => {
      const metadata = { priority: 'high', category: 'urgent' };
      const message = new Message({
        ...basicMessageOptions,
        metadata
      });
      
      const obj = message.toObject();
      expect(obj.metadata).toEqual(metadata);
    });
  });

  describe('content handling', () => {
    it('should handle string content', () => {
      const message = new Message({
        ...basicMessageOptions,
        content: 'String content'
      });
      
      expect(message.content).toBe('String content');
    });

    it('should handle object content', () => {
      const content = { type: 'data', value: 42 };
      const message = new Message({
        ...basicMessageOptions,
        content
      });
      
      expect(message.content).toEqual(content);
    });

    it('should handle array content', () => {
      const content = [1, 2, 3, 'test'];
      const message = new Message({
        ...basicMessageOptions,
        content
      });
      
      expect(message.content).toEqual(content);
    });

    it('should handle null content', () => {
      const message = new Message({
        ...basicMessageOptions,
        content: null
      });
      
      expect(message.content).toBeNull();
    });
  });
});