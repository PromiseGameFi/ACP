/**
 * Conversation class for managing multi-agent conversations
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../core/message.js';
import { ConversationContext, ConversationState } from '../types/index.js';

export interface ConversationOptions {
  id?: string;
  participants: string[];
  protocol?: string;
  initiator: string;
  timeout?: number;
  maxMessages?: number;
  metadata?: Record<string, unknown>;
}

export class Conversation extends EventEmitter {
  public readonly id: string;
  public readonly participants: string[];
  public readonly protocol?: string;
  public readonly initiator: string;
  public readonly timeout?: number;
  public readonly maxMessages?: number;
  public readonly created: number;
  
  private _state: ConversationState = 'initiated';
  private _updated: number;
  private _messages: Message[] = [];
  private _messageIndex: Map<string, Message> = new Map();
  private _metadata: Record<string, unknown>;
  private _timeoutHandle?: NodeJS.Timeout | undefined;
  private _result?: unknown;
  private _error?: Error;

  constructor(options: ConversationOptions) {
    super();
    
    if (!options.initiator) {
      throw new Error('Conversation initiator is required');
    }
    
    if (!options.participants || options.participants.length === 0) {
      throw new Error('Conversation must have at least one participant');
    }

    if (options.timeout && options.timeout <= 0) {
      throw new Error('Timeout must be positive');
    }

    if (options.maxMessages && options.maxMessages <= 0) {
      throw new Error('Max messages must be positive');
    }

    this.id = options.id || uuidv4();
    this.participants = [...options.participants];
    if (options.protocol !== undefined) {
      this.protocol = options.protocol;
    }
    this.initiator = options.initiator;
    if (options.timeout !== undefined) {
      this.timeout = options.timeout;
    }
    if (options.maxMessages !== undefined) {
      this.maxMessages = options.maxMessages;
    }
    this.created = Date.now();
    this._updated = this.created;
    this._metadata = options.metadata || {};

    // Ensure initiator is in participants
    if (!this.participants.includes(this.initiator)) {
      this.participants.push(this.initiator);
    }

    this.setupTimeout();
  }

  /**
   * Gets the current state of the conversation
   */
  get state(): ConversationState {
    return this._state;
  }

  /**
   * Gets the last updated timestamp
   */
  get updated(): number {
    return this._updated;
  }

  /**
   * Gets the conversation metadata
   */
  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  /**
   * Gets the conversation result (if completed)
   */
  get result(): unknown {
    return this._result;
  }

  /**
   * Gets the conversation error (if failed)
   */
  get error(): Error | undefined {
    return this._error;
  }

  /**
   * Activates the conversation
   */
  activate(): void {
    if (this._state !== 'initiated') {
      throw new Error(`Cannot activate conversation from state: ${this._state}`);
    }
    
    this.transitionTo('active');
  }

  /**
   * Sets the conversation to waiting state
   */
  setWaiting(): void {
    if (!this.isActive()) {
      throw new Error(`Cannot set waiting from state: ${this._state}`);
    }
    
    this.transitionTo('waiting');
  }

  /**
   * Completes the conversation
   */
  complete(result?: unknown): void {
    if (this.isTerminal()) {
      throw new Error(`Cannot complete conversation from terminal state: ${this._state}`);
    }
    
    this._result = result;
    this.transitionTo('completed');
  }

  /**
   * Fails the conversation
   */
  fail(error: Error | string): void {
    if (this.isTerminal()) {
      throw new Error(`Cannot fail conversation from terminal state: ${this._state}`);
    }
    
    this._error = error instanceof Error ? error : new Error(error);
    this.transitionTo('failed');
  }

  /**
   * Cancels the conversation
   */
  cancel(reason?: string): void {
    if (this.isTerminal()) {
      throw new Error(`Cannot cancel conversation from terminal state: ${this._state}`);
    }
    
    if (reason) {
      this._metadata.cancellationReason = reason;
    }
    this.transitionTo('cancelled');
  }

  /**
   * Handles conversation timeout
   */
  private handleTimeout(): void {
    if (!this.isTerminal()) {
      this.transitionTo('timeout');
    }
  }

  /**
   * Transitions to a new state
   */
  private transitionTo(newState: ConversationState): void {
    const oldState = this._state;
    this._state = newState;
    this._updated = Date.now();
    
    this.clearTimeout();
    
    this.emit('stateChanged', newState, oldState);
    this.emit(newState);
  }

  /**
   * Sets up conversation timeout
   */
  private setupTimeout(): void {
    if (this.timeout) {
      this._timeoutHandle = setTimeout(() => {
        this.handleTimeout();
      }, this.timeout);
    }
  }

  /**
   * Clears the conversation timeout
   */
  private clearTimeout(): void {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = undefined;
    }
  }

  /**
   * Adds a message to the conversation
   */
  addMessage(message: Message): void {
    if (message.conversationId !== undefined && message.conversationId !== this.id) {
      throw new Error('Message conversation ID does not match');
    }

    if (this.maxMessages && this._messages.length >= this.maxMessages) {
      throw new Error('Maximum number of messages reached');
    }

    this._messages.push(message);
    this._messageIndex.set(message.id, message);
    this._updated = Date.now();

    this.emit('messageAdded', message);
  }

  /**
   * Gets a message by ID
   */
  getMessage(messageId: string): Message | null {
    return this._messageIndex.get(messageId) || null;
  }

  /**
   * Gets all messages in the conversation
   */
  getMessages(): Message[] {
    return [...this._messages];
  }

  /**
   * Gets the number of messages
   */
  getMessageCount(): number {
    return this._messages.length;
  }

  /**
   * Gets the last message
   */
  getLastMessage(): Message | null {
    return this._messages.length > 0 ? this._messages[this._messages.length - 1] as Message : null;
  }

  /**
   * Gets messages from a specific sender
   */
  getMessagesFrom(sender: string): Message[] {
    return this._messages.filter(msg => msg.sender === sender);
  }

  /**
   * Gets messages by performative
   */
  getMessagesByPerformative(performative: string): Message[] {
    return this._messages.filter(msg => msg.performative === performative);
  }

  /**
   * Finds a message by ID
   */
  findMessage(messageId: string): Message | null {
    return this.getMessage(messageId);
  }

  /**
   * Adds a participant to the conversation
   */
  addParticipant(agentId: string): void {
    if (!this.participants.includes(agentId)) {
      this.participants.push(agentId);
      this._updated = Date.now();
      this.emit('participantAdded', agentId);
    }
  }

  /**
   * Removes a participant from the conversation
   */
  removeParticipant(agentId: string): void {
    if (agentId === this.initiator) {
      throw new Error('Cannot remove conversation initiator');
    }

    const index = this.participants.indexOf(agentId);
    if (index !== -1) {
      this.participants.splice(index, 1);
      this._updated = Date.now();
      this.emit('participantRemoved', agentId);
    }
  }

  /**
   * Checks if an agent is a participant
   */
  hasParticipant(agentId: string): boolean {
    return this.participants.includes(agentId);
  }

  /**
   * Gets the number of participants
   */
  getParticipantCount(): number {
    return this.participants.length;
  }

  /**
   * Sets metadata
   */
  setMetadata(key: string, value: unknown): void {
    this._metadata[key] = value;
    this._updated = Date.now();
  }

  /**
   * Gets metadata value
   */
  getMetadata(key: string): unknown {
    return this._metadata[key];
  }

  /**
   * State checking methods
   */
  isActive(): boolean {
    return this._state === 'active';
  }

  isCompleted(): boolean {
    return this._state === 'completed';
  }

  isFailed(): boolean {
    return this._state === 'failed';
  }

  isCancelled(): boolean {
    return this._state === 'cancelled';
  }

  isTimedOut(): boolean {
    return this._state === 'timeout';
  }

  isTerminal(): boolean {
    return ['completed', 'failed', 'cancelled', 'timeout'].includes(this._state);
  }

  /**
   * Converts the conversation to a context object
   */
  toContext(): ConversationContext {
    const context: ConversationContext = {
      id: this.id,
      participants: [...this.participants],
      state: this._state,
      metadata: { ...this._metadata },
      created: this.created,
      updated: this._updated
    };
    
    if (this.protocol !== undefined) {
      context.protocol = this.protocol;
    }
    
    return context;
  }

  /**
   * Creates a Conversation instance from a context object
   */
  static fromContext(context: ConversationContext, options?: { timeout?: number; maxMessages?: number }): Conversation {
    if (context.participants.length === 0) {
      throw new Error('Conversation must have at least one participant');
    }
    
    const conversationOptions: any = {
      id: context.id,
      participants: context.participants,
      initiator: context.participants[0]! // Assume first participant is initiator
    };
    
    if (context.protocol !== undefined) {
      conversationOptions.protocol = context.protocol;
    }
    if (options?.timeout !== undefined) {
      conversationOptions.timeout = options.timeout;
    }
    if (options?.maxMessages !== undefined) {
      conversationOptions.maxMessages = options.maxMessages;
    }
    if (context.metadata !== undefined) {
      conversationOptions.metadata = context.metadata;
    }
    
    const conversation = new Conversation(conversationOptions);
    
    conversation._state = context.state;
    conversation._updated = context.updated;
    
    return conversation;
  }
}