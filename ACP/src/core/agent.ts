/**
 * Agent class for Agent Communication Protocol (ACP)
 * 
 * Represents an autonomous agent capable of communicating with other agents
 * through standardized ACP messages and protocols.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Message } from './message.js';
import { 
  AgentMetadata, 
  AgentCapability, 
  AgentEndpoint, 
  AgentStatus, 
  ACPMessage,
  ProtocolHandler 
} from '../types/index.js';

export interface AgentOptions {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  capabilities?: AgentCapability[];
  endpoints?: AgentEndpoint[];
  protocols?: string[];
  tags?: string[];
  owner?: string;
}

export class Agent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly version?: string;
  public readonly capabilities: AgentCapability[];
  public readonly endpoints: AgentEndpoint[];
  public readonly protocols: string[];
  public readonly tags: string[];
  public readonly owner?: string;
  public readonly created: number;
  
  private _status: AgentStatus = 'offline';
  private _updated: number;
  private _messageHandlers: Map<string, (message: Message) => Promise<void>> = new Map();
  private _protocolHandlers: Map<string, ProtocolHandler> = new Map();
  private _conversations: Map<string, string[]> = new Map(); // conversationId -> messageIds
  
  constructor(options: AgentOptions) {
    super();
    
    if (!options.name || options.name.trim() === '') {
      throw new Error('Agent name is required');
    }
    
    this.id = options.id || uuidv4();
    this.name = options.name;
    if (options.description !== undefined) {
      this.description = options.description;
    }
    if (options.version !== undefined) {
      this.version = options.version;
    }
    this.capabilities = options.capabilities || [];
    this.endpoints = options.endpoints || [];
    this.protocols = options.protocols || [];
    this.tags = options.tags || [];
    if (options.owner !== undefined) {
      this.owner = options.owner;
    }
    this.created = Date.now();
    this._updated = this.created;

    this.setupDefaultHandlers();
  }

  /**
   * Gets the current status of the agent
   */
  get status(): AgentStatus {
    return this._status;
  }

  /**
   * Gets the last updated timestamp
   */
  get updated(): number {
    return this._updated;
  }

  /**
   * Sets up default message handlers
   */
  private setupDefaultHandlers(): void {
    // Handle ping messages
    this.onMessage('ping', async (message: Message) => {
      const reply = message.createReply(
        { status: this._status, timestamp: Date.now() },
        'pong',
        { sender: this.id }
      );
      await this.sendMessage(reply);
    });

    // Handle capability queries
    this.onMessage('query-ref', async (message: Message) => {
      if (message.content === 'capabilities') {
        const reply = message.createReply(
          this.capabilities,
          'inform',
          { sender: this.id }
        );
        await this.sendMessage(reply);
      }
    });
  }

  /**
   * Starts the agent
   */
  async start(): Promise<void> {
    this._status = 'idle';
    this._updated = Date.now();
    this.emit('statusChanged', this._status);
    this.emit('started');
  }

  /**
   * Stops the agent
   */
  async stop(): Promise<void> {
    this._status = 'offline';
    this._updated = Date.now();
    this.emit('statusChanged', this._status);
    this.emit('stopped');
  }

  /**
   * Sets the agent status
   */
  setStatus(status: AgentStatus): void {
    const oldStatus = this._status;
    this._status = status;
    this._updated = Date.now();
    
    if (oldStatus !== status) {
      this.emit('statusChanged', status, oldStatus);
    }
  }

  /**
   * Registers a message handler for a specific performative
   */
  onMessage(performative: string, handler: (message: Message) => Promise<void>): void {
    this._messageHandlers.set(performative, handler);
  }

  /**
   * Registers a protocol handler
   */
  registerProtocol(protocol: ProtocolHandler): void {
    this._protocolHandlers.set(protocol.name, protocol);
    if (!this.protocols.includes(protocol.name)) {
      (this.protocols as string[]).push(protocol.name);
    }
  }

  /**
   * Handles an incoming message
   */
  async handleMessage(message: Message): Promise<void> {
    try {
      this.setStatus('busy');
      
      // Track conversation
      if (message.conversationId) {
        if (!this._conversations.has(message.conversationId)) {
          this._conversations.set(message.conversationId, []);
        }
        this._conversations.get(message.conversationId)!.push(message.id);
      }

      // Emit message received event
      this.emit('messageReceived', message);

      // Protocol handlers would need to be invoked differently
      // since Message doesn't have a protocol property

      // Try specific performative handlers
      if (this._messageHandlers.has(message.performative)) {
        const handler = this._messageHandlers.get(message.performative)!;
        await handler(message);
        return;
      }

      // Try generic message handler
      if (this._messageHandlers.has('*')) {
        const handler = this._messageHandlers.get('*')!;
        await handler(message);
        return;
      }

      // Send not-understood if no handler found
      if (message.performative === 'request') {
        const reply = message.createReply({
          performative: 'not-understood',
          content: { reason: `No handler for performative: ${message.performative}` },
          sender: this.id
        });
        await this.sendMessage(reply);
      }

    } catch (error) {
      this.emit('error', error);
      
      // Send failure response if message expects reply
      if (message.performative === 'request') {
        const reply = message.createReply({
          performative: 'failure',
          content: { 
            reason: 'Internal error', 
            details: error instanceof Error ? error.message : String(error) 
          },
          sender: this.id
        });
        await this.sendMessage(reply);
      }
    } finally {
      this.setStatus('idle');
    }
  }

  /**
   * Sends a message (to be implemented by transport layer)
   */
  async sendMessage(message: Message): Promise<void> {
    // Track conversation
    if (message.conversationId) {
      if (!this._conversations.has(message.conversationId)) {
        this._conversations.set(message.conversationId, []);
      }
      this._conversations.get(message.conversationId)!.push(message.id);
    }

    this.emit('messageSent', message);
    
    // This is a base implementation - transport layers should override this
    console.log(`Agent ${this.id} sending message:`, message.toObject());
  }

  /**
   * Creates and sends a message
   */
  async send(options: Omit<ACPMessage, 'id' | 'timestamp' | 'sender'> & { sender?: string }): Promise<Message> {
    const message = new Message({
      ...options,
      sender: options.sender || this.id
    });
    
    await this.sendMessage(message);
    return message;
  }

  /**
   * Adds a capability to the agent
   */
  addCapability(capability: AgentCapability): void {
    // Check if capability already exists
    if (!this.hasCapability(capability.name)) {
      this.capabilities.push(capability);
      this._updated = Date.now();
      this.emit('capabilityAdded', capability);
    }
  }

  /**
   * Removes a capability from the agent
   */
  removeCapability(capabilityName: string): boolean {
    const index = this.capabilities.findIndex(cap => cap.name === capabilityName);
    if (index !== -1) {
      const removed = this.capabilities.splice(index, 1)[0];
      this._updated = Date.now();
      this.emit('capabilityRemoved', removed);
      return true;
    }
    return false;
  }

  /**
   * Checks if the agent has a specific capability
   */
  hasCapability(capabilityName: string): boolean {
    return this.capabilities.some(cap => cap.name === capabilityName);
  }

  /**
   * Gets conversation message IDs
   */
  getConversationMessages(conversationId: string): string[] {
    return this._conversations.get(conversationId) || [];
  }

  /**
   * Gets all active conversations
   */
  getActiveConversations(): string[] {
    return Array.from(this._conversations.keys());
  }

  /**
   * Converts the agent to metadata object
   */
  toMetadata(): AgentMetadata {
    const metadata: AgentMetadata = {
      id: this.id,
      name: this.name,
      capabilities: this.capabilities,
      endpoints: this.endpoints,
      protocols: this.protocols,
      status: this._status,
      created: this.created,
      updated: this._updated
    };

    if (this.description !== undefined) {
      metadata.description = this.description;
    }
    if (this.version !== undefined) {
      metadata.version = this.version;
    }
    if (this.tags !== undefined) {
      metadata.tags = this.tags;
    }
    if (this.owner !== undefined) {
      metadata.owner = this.owner;
    }

    return metadata;
  }

  /**
   * Creates an Agent instance from metadata
   */
  static fromMetadata(metadata: AgentMetadata): Agent {
    const options: AgentOptions = {
      id: metadata.id,
      name: metadata.name,
      capabilities: metadata.capabilities,
      endpoints: metadata.endpoints,
      protocols: metadata.protocols
    };

    if (metadata.description !== undefined) {
      options.description = metadata.description;
    }
    if (metadata.version !== undefined) {
      options.version = metadata.version;
    }
    if (metadata.tags !== undefined) {
      options.tags = metadata.tags;
    }
    if (metadata.owner !== undefined) {
      options.owner = metadata.owner;
    }

    const agent = new Agent(options);
    
    agent._status = metadata.status;
    agent._updated = metadata.updated;
    
    return agent;
  }
}