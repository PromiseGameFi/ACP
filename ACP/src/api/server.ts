/**
 * ACP REST API Server
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Agent } from '../core/agent.js';
import { Message } from '../core/message.js';
import { Conversation } from '../conversation/conversation.js';
import { RequestResponseProtocol } from '../conversation/protocols/request-response.js';
import { 
  ACPMessage, 
  ACPResponse, 
  ACPError,
  AgentRegistrationRequest,
  MessageSendRequest,
  ConversationCreateRequest 
} from '../types/index.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
  corsOptions?: cors.CorsOptions;
}

export class ACPServer {
  private app: Express;
  private agents: Map<string, Agent> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private protocols: Map<string, RequestResponseProtocol> = new Map();
  private port: number;
  private host: string;

  constructor(options: ServerOptions = {}) {
    this.app = express();
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';

    this.setupMiddleware(options);
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Sets up Express middleware
   */
  private setupMiddleware(options: ServerOptions): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    if (options.cors !== false) {
      this.app.use(cors(options.corsOptions));
    }

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Sets up API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Agent routes
    this.app.post('/agents', this.registerAgent.bind(this));
    this.app.get('/agents', this.listAgents.bind(this));
    this.app.get('/agents/:id', this.getAgent.bind(this));
    this.app.put('/agents/:id', this.updateAgent.bind(this));
    this.app.delete('/agents/:id', this.unregisterAgent.bind(this));
    this.app.get('/agents/:id/status', this.getAgentStatus.bind(this));
    this.app.put('/agents/:id/status', this.updateAgentStatus.bind(this));

    // Message routes
    this.app.post('/messages', this.sendMessage.bind(this));
    this.app.get('/messages/:id', this.getMessage.bind(this));
    this.app.get('/agents/:id/messages', this.getAgentMessages.bind(this));

    // Conversation routes
    this.app.post('/conversations', this.createConversation.bind(this));
    this.app.get('/conversations', this.listConversations.bind(this));
    this.app.get('/conversations/:id', this.getConversation.bind(this));
    this.app.put('/conversations/:id', this.updateConversation.bind(this));
    this.app.delete('/conversations/:id', this.deleteConversation.bind(this));
    this.app.get('/conversations/:id/messages', this.getConversationMessages.bind(this));
    this.app.post('/conversations/:id/messages', this.addConversationMessage.bind(this));

    // Protocol routes
    this.app.get('/protocols', this.listProtocols.bind(this));
    this.app.get('/protocols/:name', this.getProtocol.bind(this));
  }

  /**
   * Sets up error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.path} not found`
        }
      } as ACPResponse<null>);
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Server error:', err);
      
      const error: ACPError = {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Internal server error',
        timestamp: Date.now()
      };

      res.status(500).json({
        success: false,
        error
      } as ACPResponse<null>);
    });
  }

  /**
   * Agent registration endpoint
   */
  private async registerAgent(req: Request, res: Response): Promise<void> {
    try {
      const { agent: agentData }: AgentRegistrationRequest = req.body;
      
      if (!agentData.id || !agentData.name) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Agent ID and name are required'
          }
        } as ACPResponse<null>);
        return;
      }

      if (this.agents.has(agentData.id)) {
        res.status(409).json({
          success: false,
          error: {
            code: 'AGENT_EXISTS',
            message: `Agent with ID ${agentData.id} already exists`
          }
        } as ACPResponse<null>);
        return;
      }

      const agentOptions: any = {
        id: agentData.id,
        name: agentData.name,
        capabilities: agentData.capabilities || [],
        endpoints: agentData.endpoints || [],
        protocols: agentData.protocols || []
      };

      if (agentData.description !== undefined) {
        agentOptions.description = agentData.description;
      }

      const agent = new Agent(agentOptions);

      this.agents.set(agent.id, agent);

      res.status(201).json({
        success: true,
        data: agent.toMetadata()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * List agents endpoint
   */
  private async listAgents(req: Request, res: Response): Promise<void> {
    try {
      const agents = Array.from(this.agents.values()).map(agent => agent.toMetadata());
      
      res.json({
        success: true,
        data: agents
      } as ACPResponse<any[]>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get agent endpoint
   */
  private async getAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AGENT_ID',
            message: 'Agent ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const agent = this.agents.get(id);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      res.json({
        success: true,
        data: agent.toMetadata()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Update agent endpoint
   */
  private async updateAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AGENT_ID',
            message: 'Agent ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const agent = this.agents.get(id);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      const updates = req.body;
      
      // Note: Agent properties are readonly, so we can only update status
      // For other updates, a new agent would need to be created
      if (updates.status) {
        agent.setStatus(updates.status);
      }

      res.json({
        success: true,
        data: agent.toMetadata()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Unregister agent endpoint
   */
  private async unregisterAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AGENT_ID',
            message: 'Agent ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      if (!this.agents.has(id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      this.agents.delete(id);

      res.json({
        success: true,
        data: null
      } as ACPResponse<null>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get agent status endpoint
   */
  private async getAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AGENT_ID',
            message: 'Agent ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const agent = this.agents.get(id);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      res.json({
        success: true,
        data: { status: agent.status }
      } as ACPResponse<{ status: string }>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Update agent status endpoint
   */
  private async updateAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AGENT_ID',
            message: 'Agent ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const agent = this.agents.get(id);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      agent.setStatus(status);

      res.json({
        success: true,
        data: { status: agent.status }
      } as ACPResponse<{ status: string }>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Send message endpoint
   */
  private async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const messageData: MessageSendRequest = req.body;
      
      const messageOptions: any = {
        sender: messageData.sender,
        receiver: messageData.receiver,
        performative: messageData.performative,
        content: messageData.content
      };
      
      if (messageData.conversationId !== undefined) {
        messageOptions.conversationId = messageData.conversationId;
      }
      if (messageData.contentType !== undefined) {
        messageOptions.contentType = messageData.contentType;
      }
      if (messageData.inReplyTo !== undefined) {
        messageOptions.inReplyTo = messageData.inReplyTo;
      }
      if (messageData.language !== undefined) {
        messageOptions.language = messageData.language;
      }
      if (messageData.encoding !== undefined) {
        messageOptions.encoding = messageData.encoding;
      }
      if (messageData.ontology !== undefined) {
        messageOptions.ontology = messageData.ontology;
      }
      if (messageData.metadata !== undefined) {
        messageOptions.metadata = messageData.metadata;
      }
      
      const message = new Message(messageOptions);

      // If conversation ID is provided, add to conversation
      if (message.conversationId) {
        const conversation = this.conversations.get(message.conversationId);
        if (conversation) {
          conversation.addMessage(message);
        }
      }

      // Deliver message to receiver agent(s)
      const receivers = Array.isArray(message.receiver) ? message.receiver : [message.receiver];
      for (const receiverId of receivers) {
        const receiverAgent = this.agents.get(receiverId);
        if (receiverAgent) {
          await receiverAgent.handleMessage(message);
        }
      }

      res.status(201).json({
        success: true,
        data: message.toObject()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get message endpoint
   */
  private async getMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MESSAGE_ID',
            message: 'Message ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      // Find message across all conversations
      let foundMessage: Message | null = null;
      for (const conversation of this.conversations.values()) {
        foundMessage = conversation.getMessage(id);
        if (foundMessage) break;
      }

      if (!foundMessage) {
        res.status(404).json({
          success: false,
          error: {
            code: 'MESSAGE_NOT_FOUND',
            message: `Message with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      res.json({
        success: true,
        data: foundMessage.toObject()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get agent messages endpoint
   */
  private async getAgentMessages(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AGENT_ID',
            message: 'Agent ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const agent = this.agents.get(id);

      if (!agent) {
        res.status(404).json({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      // Collect messages from all conversations where agent is a participant
      const messages: any[] = [];
      for (const conversation of this.conversations.values()) {
        if (conversation.hasParticipant(id)) {
          const conversationMessages = conversation.getMessages()
            .filter(msg => msg.sender === id || msg.receiver === id)
            .map(msg => msg.toObject());
          messages.push(...conversationMessages);
        }
      }

      res.json({
        success: true,
        data: messages
      } as ACPResponse<any[]>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Create conversation endpoint
   */
  private async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const conversationData: ConversationCreateRequest = req.body;
      
      const conversationOptions: any = {
        participants: conversationData.participants,
        initiator: conversationData.initiator
      };
      
      if (conversationData.protocol !== undefined) {
        conversationOptions.protocol = conversationData.protocol;
      }
      if (conversationData.timeout !== undefined) {
        conversationOptions.timeout = conversationData.timeout;
      }
      if (conversationData.maxMessages !== undefined) {
        conversationOptions.maxMessages = conversationData.maxMessages;
      }
      if (conversationData.metadata !== undefined) {
        conversationOptions.metadata = conversationData.metadata;
      }
      
      const conversation = new Conversation(conversationOptions);

      this.conversations.set(conversation.id, conversation);

      res.status(201).json({
        success: true,
        data: conversation.toContext()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * List conversations endpoint
   */
  private async listConversations(req: Request, res: Response): Promise<void> {
    try {
      const conversations = Array.from(this.conversations.values())
        .map(conv => conv.toContext());
      
      res.json({
        success: true,
        data: conversations
      } as ACPResponse<any[]>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get conversation endpoint
   */
  private async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Conversation ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const conversation = this.conversations.get(id);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: `Conversation with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      res.json({
        success: true,
        data: conversation.toContext()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Update conversation endpoint
   */
  private async updateConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Conversation ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const conversation = this.conversations.get(id);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: `Conversation with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      const updates = req.body;
      
      if (updates.metadata) {
        Object.entries(updates.metadata).forEach(([key, value]) => {
          conversation.setMetadata(key, value);
        });
      }

      if (updates.state) {
        switch (updates.state) {
          case 'active':
            conversation.activate();
            break;
          case 'waiting':
            conversation.setWaiting();
            break;
          case 'completed':
            conversation.complete(updates.result);
            break;
          case 'failed':
            conversation.fail(updates.error || 'Conversation failed');
            break;
          case 'cancelled':
            conversation.cancel(updates.reason);
            break;
        }
      }

      res.json({
        success: true,
        data: conversation.toContext()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Delete conversation endpoint
   */
  private async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Conversation ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      if (!this.conversations.has(id)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: `Conversation with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      this.conversations.delete(id);

      res.json({
        success: true,
        data: null
      } as ACPResponse<null>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get conversation messages endpoint
   */
  private async getConversationMessages(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Conversation ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const conversation = this.conversations.get(id);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: `Conversation with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      const messages = conversation.getMessages().map(msg => msg.toObject());

      res.json({
        success: true,
        data: messages
      } as ACPResponse<any[]>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Add message to conversation endpoint
   */
  private async addConversationMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONVERSATION_ID',
            message: 'Conversation ID is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const conversation = this.conversations.get(id);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: `Conversation with ID ${id} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      const messageData = req.body;
      const message = new Message({
        ...messageData,
        conversationId: id
      });

      conversation.addMessage(message);

      res.status(201).json({
        success: true,
        data: message.toObject()
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * List protocols endpoint
   */
  private async listProtocols(req: Request, res: Response): Promise<void> {
    try {
      const protocols = Array.from(this.protocols.keys());
      
      res.json({
        success: true,
        data: protocols
      } as ACPResponse<string[]>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get protocol endpoint
   */
  private async getProtocol(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      
      if (!name) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PROTOCOL_NAME',
            message: 'Protocol name is required'
          }
        } as ACPResponse<null>);
        return;
      }
      
      const protocol = this.protocols.get(name);

      if (!protocol) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PROTOCOL_NOT_FOUND',
            message: `Protocol ${name} not found`
          }
        } as ACPResponse<null>);
        return;
      }

      res.json({
        success: true,
        data: {
          name: protocol.name,
          state: protocol.getCurrentState(),
          pendingRequests: protocol.getPendingRequestCount()
        }
      } as ACPResponse<any>);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Error handler helper
   */
  private handleError(res: Response, error: unknown): void {
    console.error('API Error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message
      }
    } as ACPResponse<null>);
  }

  /**
   * Registers a protocol with the server
   */
  registerProtocol(protocol: RequestResponseProtocol): void {
    this.protocols.set(protocol.name, protocol);
  }

  /**
   * Starts the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, this.host, () => {
        console.log(`ACP Server running on http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Gets the Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Gets registered agents
   */
  getAgents(): Map<string, Agent> {
    return this.agents;
  }

  /**
   * Gets active conversations
   */
  getConversations(): Map<string, Conversation> {
    return this.conversations;
  }

  /**
   * Gets registered protocols
   */
  getProtocols(): Map<string, RequestResponseProtocol> {
    return this.protocols;
  }
}