/**
 * Core types and interfaces for the Agent Communication Protocol (ACP)
 */

// Message types
export interface ACPMessage {
  id: string;
  conversationId?: string;
  performative: string;
  sender: string;
  receiver: string | string[];
  content: unknown;
  contentType?: string;
  timestamp: number;
  inReplyTo?: string;
  language?: string;
  encoding?: string;
  ontology?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  parameters?: Record<string, unknown>;
}

export interface AgentMetadata {
  id: string;
  name: string;
  description?: string;
  version?: string;
  capabilities: AgentCapability[];
  endpoints: AgentEndpoint[];
  protocols: string[];
  status: AgentStatus;
  tags?: string[];
  owner?: string;
  created: number;
  updated: number;
}

export interface AgentEndpoint {
  type: 'http' | 'websocket' | 'grpc';
  url: string;
  methods?: string[];
  description?: string;
}

export type AgentStatus = 'online' | 'offline' | 'busy' | 'idle' | 'error';

export interface ConversationContext {
  id: string;
  participants: string[];
  protocol?: string;
  state: ConversationState;
  metadata?: Record<string, unknown>;
  created: number;
  updated: number;
}

export type ConversationState = 
  | 'initiated' 
  | 'active' 
  | 'waiting' 
  | 'completed' 
  | 'failed' 
  | 'timeout' 
  | 'cancelled';

export interface ProtocolHandler {
  name: string;
  version: string;
  handleMessage(message: ACPMessage): Promise<ACPMessage | null>;
  validateMessage(message: ACPMessage): boolean;
  getStates(): string[];
}

export interface ACPError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface ACPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ACPError;
  timestamp: number;
}

// HTTP Request/Response types for REST API
export interface SendMessageRequest {
  message: Omit<ACPMessage, 'id' | 'timestamp'>;
}

export interface AgentRegistrationRequest {
  agent: Omit<AgentMetadata, 'created' | 'updated'>;
}

export interface MessageSendRequest {
  sender: string;
  receiver: string | string[];
  performative: string;
  content: unknown;
  conversationId?: string;
  contentType?: string;
  inReplyTo?: string;
  language?: string;
  encoding?: string;
  ontology?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationCreateRequest {
  participants: string[];
  protocol?: string;
  initiator: string;
  timeout?: number;
  maxMessages?: number;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResponse extends ACPResponse<{ messageId: string }> {}

export interface GetMessagesResponse extends ACPResponse<ACPMessage[]> {}

export interface AgentDiscoveryResponse extends ACPResponse<AgentMetadata[]> {}

export interface ConversationResponse extends ACPResponse<ConversationContext> {}

// Event types for real-time communication
export interface MessageEvent {
  type: 'message';
  data: ACPMessage;
}

export interface AgentEvent {
  type: 'agent_status' | 'agent_registered' | 'agent_unregistered';
  data: AgentMetadata;
}

export interface ConversationEvent {
  type: 'conversation_started' | 'conversation_ended' | 'conversation_updated';
  data: ConversationContext;
}

export type ACPEvent = MessageEvent | AgentEvent | ConversationEvent;