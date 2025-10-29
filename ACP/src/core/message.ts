/**
 * Message class for Agent Communication Protocol (ACP)
 * 
 * Represents a message exchanged between agents following ACP standards.
 * Supports all FIPA-ACL performatives and extensible content types via MIME types.
 */

import { v4 as uuidv4 } from 'uuid';
import { ACPMessage } from '../types/index.js';

export interface MessageOptions {
  id?: string;
  timestamp?: number;
  conversationId?: string;
  performative: string;
  sender: string;
  receiver: string | string[];
  content: unknown;
  contentType?: string;
  inReplyTo?: string;
  language?: string;
  encoding?: string;
  ontology?: string;
  metadata?: Record<string, unknown>;
}

export class Message implements ACPMessage {
  public readonly id: string;
  public readonly conversationId?: string;
  public readonly performative: string;
  public readonly sender: string;
  public readonly receiver: string | string[];
  public readonly content: unknown;
  public readonly contentType?: string;
  public readonly timestamp: number;
  public readonly inReplyTo?: string;
  public readonly language?: string;
  public readonly encoding?: string;
  public readonly ontology?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(options: MessageOptions) {
    this.id = options.id || uuidv4();
    this.timestamp = options.timestamp || Date.now();
    this.performative = options.performative;
    this.sender = options.sender;
    this.receiver = options.receiver;
    this.content = options.content;
    
    // Handle optional properties
    if (options.conversationId !== undefined) this.conversationId = options.conversationId;
    if (options.contentType !== undefined) this.contentType = options.contentType;
    if (options.inReplyTo !== undefined) this.inReplyTo = options.inReplyTo;
    if (options.language !== undefined) this.language = options.language;
    if (options.encoding !== undefined) this.encoding = options.encoding;
    if (options.ontology !== undefined) this.ontology = options.ontology;
    if (options.metadata !== undefined) this.metadata = options.metadata;

    this.validate();
  }

  /**
   * Validates the message structure and content
   */
  private validate(): void {
    if (!this.performative) {
      throw new Error('Performative is required');
    }

    if (!this.sender) {
      throw new Error('Sender is required');
    }
    
    if (!this.receiver) {
      throw new Error('Receiver is required');
    }

    if (Array.isArray(this.receiver) && this.receiver.length === 0) {
      throw new Error('Message receiver array cannot be empty');
    }

    // Validate performative against known FIPA-ACL performatives
    const validPerformatives = [
      'accept-proposal', 'agree', 'cancel', 'cfp', 'confirm', 'disconfirm',
      'failure', 'inform', 'inform-if', 'inform-ref', 'not-understood',
      'propose', 'query-if', 'query-ref', 'refuse', 'reject-proposal',
      'request', 'request-when', 'request-whenever', 'subscribe'
    ];

    if (!validPerformatives.includes(this.performative.toLowerCase())) {
      console.warn(`Unknown performative: ${this.performative}. Consider using standard FIPA-ACL performatives.`);
    }
  }

  /**
   * Creates a reply message to this message
   */
  createReply(content: unknown, performative: string = 'inform', options: Partial<MessageOptions> = {}): Message {
    const messageOptions: MessageOptions = {
      performative,
      sender: options.sender || '',
      receiver: this.sender,
      content
    };

    if (this.conversationId) messageOptions.conversationId = this.conversationId;
    if (options.contentType) messageOptions.contentType = options.contentType;
    else if (this.contentType) messageOptions.contentType = this.contentType;
    messageOptions.inReplyTo = this.id;
    if (options.language) messageOptions.language = options.language;
    else if (this.language) messageOptions.language = this.language;
    if (options.encoding) messageOptions.encoding = options.encoding;
    else if (this.encoding) messageOptions.encoding = this.encoding;
    if (options.ontology) messageOptions.ontology = options.ontology;
    else if (this.ontology) messageOptions.ontology = this.ontology;
    if (this.metadata || options.metadata) {
      messageOptions.metadata = { ...this.metadata, ...options.metadata };
    }

    return new Message(messageOptions);
  }

  /**
   * Checks if this message is a reply to another message
   */
  isReplyTo(messageId: string): boolean {
    return this.inReplyTo === messageId;
  }

  /**
   * Checks if this message is a reply to another message
   */
  isReply(): boolean {
    return Boolean(this.inReplyTo);
  }



  /**
   * Gets the list of receivers as an array
   */
  getReceivers(): string[] {
    return Array.isArray(this.receiver) ? this.receiver : [this.receiver];
  }

  /**
   * Checks if a specific agent is a receiver of this message
   */
  isReceiverOf(agentId: string): boolean {
    return this.getReceivers().includes(agentId);
  }

  /**
   * Converts the message to a plain object
   */
  toObject(): ACPMessage {
    const obj: ACPMessage = {
      id: this.id,
      performative: this.performative,
      sender: this.sender,
      receiver: this.receiver,
      content: this.content,
      timestamp: this.timestamp
    };

    if (this.conversationId) obj.conversationId = this.conversationId;
    if (this.contentType) obj.contentType = this.contentType;
    if (this.inReplyTo) obj.inReplyTo = this.inReplyTo;
    if (this.language) obj.language = this.language;
    if (this.encoding) obj.encoding = this.encoding;
    if (this.ontology) obj.ontology = this.ontology;
    if (this.metadata && Object.keys(this.metadata).length > 0) obj.metadata = this.metadata;

    return obj;
  }

  /**
   * Creates a Message instance from a plain object
   */
  static fromObject(obj: ACPMessage): Message {
    const messageOptions: MessageOptions = {
      performative: obj.performative,
      sender: obj.sender,
      receiver: obj.receiver,
      content: obj.content
    };

    if (obj.id) messageOptions.id = obj.id;
    if (obj.timestamp) messageOptions.timestamp = obj.timestamp;
    if (obj.conversationId) messageOptions.conversationId = obj.conversationId;
    if (obj.contentType) messageOptions.contentType = obj.contentType;
    if (obj.inReplyTo) messageOptions.inReplyTo = obj.inReplyTo;
    if (obj.language) messageOptions.language = obj.language;
    if (obj.encoding) messageOptions.encoding = obj.encoding;
    if (obj.ontology) messageOptions.ontology = obj.ontology;
    if (obj.metadata) messageOptions.metadata = obj.metadata;

    return new Message(messageOptions);
  }

  /**
   * Creates a Message instance from JSON string
   */
  static fromJSON(json: string): Message {
    const obj = JSON.parse(json) as ACPMessage;
    return Message.fromObject(obj);
  }

  /**
   * Converts the message to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.toObject());
  }

  /**
   * Creates a deep copy of the message
   */
  clone(): Message {
    return Message.fromObject(this.toObject());
  }

  /**
   * Utility method to create common message types
   */
  static createInform(sender: string, receiver: string | string[], content: unknown, options?: Partial<ACPMessage>): Message {
    return new Message({
      performative: 'inform',
      sender,
      receiver,
      content,
      contentType: 'application/json',
      ...options
    });
  }

  static createRequest(sender: string, receiver: string | string[], content: unknown, options?: Partial<ACPMessage>): Message {
    const messageOptions: MessageOptions = {
      performative: 'request',
      sender,
      receiver,
      content
    };

    if (options?.contentType) messageOptions.contentType = options.contentType;
    else messageOptions.contentType = 'application/json';
    
    if (options?.conversationId) messageOptions.conversationId = options.conversationId;
    if (options?.inReplyTo) messageOptions.inReplyTo = options.inReplyTo;
    if (options?.language) messageOptions.language = options.language;
    if (options?.encoding) messageOptions.encoding = options.encoding;
    if (options?.ontology) messageOptions.ontology = options.ontology;
    if (options?.metadata) messageOptions.metadata = options.metadata;

    return new Message(messageOptions);
  }

  static createAgree(sender: string, receiver: string, content: unknown, inReplyTo: string, options?: Partial<ACPMessage>): Message {
    return new Message({
      performative: 'agree',
      sender,
      receiver,
      content,
      contentType: 'application/json',
      inReplyTo,
      ...options
    });
  }

  static createRefuse(sender: string, receiver: string, content: unknown, inReplyTo: string, options?: Partial<ACPMessage>): Message {
    return new Message({
      performative: 'refuse',
      sender,
      receiver,
      content,
      contentType: 'application/json',
      inReplyTo,
      ...options
    });
  }
}