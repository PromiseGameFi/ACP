/**
 * Request-Response Protocol implementation for ACP
 */

import { EventEmitter } from 'events';
import { Message } from '../../core/message.js';
import { Conversation } from '../conversation.js';
import { ProtocolHandler, ACPMessage } from '../../types/index.js';

export interface RequestResponseOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface PendingRequest {
  id: string;
  message: Message;
  conversation: Conversation;
  timeout?: NodeJS.Timeout;
  resolve: (response: Message) => void;
  reject: (error: Error) => void;
  retries: number;
  maxRetries: number;
  retryDelay: number;
}

export class RequestResponseProtocol extends EventEmitter implements ProtocolHandler {
  public readonly name = 'request-response';
  public readonly version = '1.0.0';
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private defaultTimeout: number;
  private defaultMaxRetries: number;
  private defaultRetryDelay: number;

  constructor(options: RequestResponseOptions = {}) {
    super();
    this.defaultTimeout = options.timeout || 30000; // 30 seconds
    this.defaultMaxRetries = options.maxRetries || 3;
    this.defaultRetryDelay = options.retryDelay || 1000; // 1 second
  }

  /**
   * Validates if a message is compatible with this protocol
   */
  validateMessage(message: ACPMessage): boolean {
    return ['request', 'inform', 'failure'].includes(message.performative);
  }

  /**
   * Handles incoming messages for the protocol (ProtocolHandler interface)
   */
  async handleMessage(message: ACPMessage): Promise<ACPMessage | null> {
    // Convert ACPMessage to Message for internal processing
    const messageOptions: any = {
      id: message.id,
      performative: message.performative,
      sender: message.sender,
      receiver: message.receiver,
      content: message.content,
      timestamp: message.timestamp
    };
    
    if (message.conversationId !== undefined) {
      messageOptions.conversationId = message.conversationId;
    }
    if (message.contentType !== undefined) {
      messageOptions.contentType = message.contentType;
    }
    if (message.inReplyTo !== undefined) {
      messageOptions.inReplyTo = message.inReplyTo;
    }
    if (message.language !== undefined) {
      messageOptions.language = message.language;
    }
    if (message.encoding !== undefined) {
      messageOptions.encoding = message.encoding;
    }
    if (message.ontology !== undefined) {
      messageOptions.ontology = message.ontology;
    }
    if (message.metadata !== undefined) {
      messageOptions.metadata = message.metadata;
    }
    
    const internalMessage = new Message(messageOptions);

    if (message.performative === 'inform' && message.inReplyTo) {
      // This is a response to a request
      await this.handleResponse(internalMessage);
    } else if (message.performative === 'failure' && message.inReplyTo) {
      // This is a failure response
      await this.handleFailure(internalMessage);
    }
    
    return null; // This protocol doesn't generate automatic responses
  }

  /**
   * Handles incoming messages for the protocol (internal method with conversation context)
   */
  async handleMessageWithConversation(message: Message, conversation: Conversation): Promise<void> {
    if (message.performative === 'inform' && message.inReplyTo) {
      // This is a response to a request
      await this.handleResponse(message);
    } else if (message.performative === 'request') {
      // This is a new request
      await this.handleRequest(message, conversation);
    } else if (message.performative === 'failure' && message.inReplyTo) {
      // This is a failure response
      await this.handleFailure(message);
    }
  }

  /**
   * Initiates a request and returns a promise that resolves with the response
   */
  async initiateRequest(
    message: Message,
    conversation: Conversation,
    options: RequestResponseOptions = {}
  ): Promise<Message> {
    if (message.performative !== 'request') {
      throw new Error('Message must have performative "request"');
    }

    const timeout = options.timeout || this.defaultTimeout;
    const maxRetries = options.maxRetries || this.defaultMaxRetries;
    const retryDelay = options.retryDelay || this.defaultRetryDelay;

    return new Promise((resolve, reject) => {
      const pendingRequest: PendingRequest = {
        id: message.id,
        message,
        conversation,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        retryDelay
      };

      // Set up timeout
      if (timeout > 0) {
        pendingRequest.timeout = setTimeout(() => {
          this.handleTimeout(message.id);
        }, timeout);
      }

      this.pendingRequests.set(message.id, pendingRequest);
      this.emit('requestInitiated', message, conversation);
    });
  }

  /**
   * Handles incoming request messages
   */
  private async handleRequest(message: Message, conversation: Conversation): Promise<void> {
    this.emit('requestReceived', message, conversation);
  }

  /**
   * Handles incoming response messages
   */
  private async handleResponse(message: Message): Promise<void> {
    if (!message.inReplyTo) {
      return;
    }

    const pendingRequest = this.pendingRequests.get(message.inReplyTo);
    if (!pendingRequest) {
      return; // No pending request for this response
    }

    this.clearPendingRequest(message.inReplyTo);
    pendingRequest.resolve(message);
    this.emit('responseReceived', message, pendingRequest.message);
  }

  /**
   * Handles incoming failure messages
   */
  private async handleFailure(message: Message): Promise<void> {
    if (!message.inReplyTo) {
      return;
    }

    const pendingRequest = this.pendingRequests.get(message.inReplyTo);
    if (!pendingRequest) {
      return; // No pending request for this failure
    }

    const error = new Error(message.content?.toString() || 'Request failed');
    
    // Check if we should retry
    if (pendingRequest.retries < pendingRequest.maxRetries) {
      await this.retryRequest(pendingRequest);
    } else {
      this.clearPendingRequest(message.inReplyTo);
      pendingRequest.reject(error);
      this.emit('requestFailed', message, pendingRequest.message, error);
    }
  }

  /**
   * Handles request timeout
   */
  private handleTimeout(requestId: string): void {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest) {
      return;
    }

    const error = new Error('Request timeout');
    
    // Check if we should retry
    if (pendingRequest.retries < pendingRequest.maxRetries) {
      this.retryRequest(pendingRequest);
    } else {
      this.clearPendingRequest(requestId);
      pendingRequest.reject(error);
      this.emit('requestTimeout', pendingRequest.message, error);
    }
  }

  /**
   * Retries a failed request
   */
  private async retryRequest(pendingRequest: PendingRequest): Promise<void> {
    pendingRequest.retries++;
    
    // Clear existing timeout
    if (pendingRequest.timeout) {
      clearTimeout(pendingRequest.timeout);
    }

    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, pendingRequest.retryDelay));

    // Set up new timeout
    const timeout = this.defaultTimeout;
    if (timeout > 0) {
      pendingRequest.timeout = setTimeout(() => {
        this.handleTimeout(pendingRequest.id);
      }, timeout);
    }

    this.emit('requestRetry', pendingRequest.message, pendingRequest.retries);
  }

  /**
   * Clears a pending request
   */
  private clearPendingRequest(requestId: string): void {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      if (pendingRequest.timeout) {
        clearTimeout(pendingRequest.timeout);
      }
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Creates a response message for a request
   */
  createResponse(request: Message, content: unknown, sender: string): Message {
    const messageOptions: any = {
      sender,
      receiver: request.sender,
      performative: 'inform',
      content,
      inReplyTo: request.id
    };

    if (request.conversationId !== undefined) {
      messageOptions.conversationId = request.conversationId;
    }

    return new Message(messageOptions);
  }

  /**
   * Creates a failure response message for a request
   */
  createFailure(request: Message, error: string | Error, sender: string): Message {
    const errorMessage = error instanceof Error ? error.message : error;
    
    const messageOptions: any = {
      sender,
      receiver: request.sender,
      performative: 'failure',
      content: errorMessage,
      inReplyTo: request.id
    };

    if (request.conversationId !== undefined) {
      messageOptions.conversationId = request.conversationId;
    }

    return new Message(messageOptions);
  }

  /**
   * Gets all pending requests
   */
  getPendingRequests(): PendingRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Gets a pending request by ID
   */
  getPendingRequest(requestId: string): PendingRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * Cancels a pending request
   */
  cancelRequest(requestId: string): boolean {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      this.clearPendingRequest(requestId);
      pendingRequest.reject(new Error('Request cancelled'));
      this.emit('requestCancelled', pendingRequest.message);
      return true;
    }
    return false;
  }

  /**
   * Cancels all pending requests
   */
  cancelAllRequests(): void {
    const requestIds = Array.from(this.pendingRequests.keys());
    requestIds.forEach(id => this.cancelRequest(id));
  }

  /**
   * Gets the number of pending requests
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Checks if there are any pending requests
   */
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }

  /**
   * Gets protocol states
   */
  getStates(): string[] {
    return ['idle', 'waiting', 'processing'];
  }

  /**
   * Gets current protocol state
   */
  getCurrentState(): string {
    if (this.pendingRequests.size === 0) {
      return 'idle';
    } else {
      return 'waiting';
    }
  }

  /**
   * Cleanup method to clear all pending requests
   */
  cleanup(): void {
    this.cancelAllRequests();
    this.removeAllListeners();
  }
}