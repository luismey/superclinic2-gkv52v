// @ts-check
import { get, post, patch } from '../lib/api';
import { SocketClient } from '../lib/socket';
import { 
  Chat, 
  Message, 
  MessageType, 
  MessageStatus, 
  ChatEvent,
  MessageValidation,
  MAX_MESSAGE_LENGTH,
  SUPPORTED_MIME_TYPES
} from '../types/chat';
import { getSecureStorage, StorageKeys } from '../lib/storage';

// Socket client instance with reconnection settings
let socketClient: SocketClient | null = null;

// Constants for API endpoints and error handling
const API_ENDPOINTS = {
  CHATS: '/chats',
  MESSAGES: '/messages',
  AI_TOGGLE: '/chats/:id/ai',
  MESSAGE_STATUS: '/messages/:id/status',
  OFFLINE_QUEUE: '/messages/queue'
} as const;

const ERROR_CODES = {
  NETWORK_ERROR: 'CHAT_001',
  AUTH_ERROR: 'CHAT_002',
  MESSAGE_ERROR: 'CHAT_003',
  VALIDATION_ERROR: 'CHAT_004'
} as const;

/**
 * Interface for chat service initialization options
 */
interface ChatServiceOptions {
  reconnectInterval?: number;
  maxRetries?: number;
  debug?: boolean;
}

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

/**
 * Validates a message before sending
 * @param message - Message to validate
 * @returns Validation result
 */
const validateMessage = (message: Partial<Message>): MessageValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check content length
  if (!message.content || message.content.length === 0) {
    errors.push('Message content is required');
  } else if (message.content.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
  }

  // Validate media types
  if (message.type !== MessageType.TEXT && message.metadata?.mime_type) {
    const supportedTypes = SUPPORTED_MIME_TYPES[message.type.toLowerCase() as keyof typeof SUPPORTED_MIME_TYPES];
    if (supportedTypes && !supportedTypes.includes(message.metadata.mime_type)) {
      errors.push(`Unsupported mime type for ${message.type}: ${message.metadata.mime_type}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Chat service for managing real-time messaging and WhatsApp integration
 */
class ChatService {
  private options: ChatServiceOptions;
  private initialized: boolean = false;

  constructor(options: ChatServiceOptions = {}) {
    this.options = {
      reconnectInterval: 5000,
      maxRetries: 3,
      debug: false,
      ...options
    };
  }

  /**
   * Initializes the chat service with authentication and WebSocket connection
   * @param authToken - Authentication token
   */
  public async initialize(authToken: string): Promise<void> {
    try {
      if (this.initialized) return;

      socketClient = new SocketClient(authToken, {
        reconnectDelay: this.options.reconnectInterval,
        maxRetries: this.options.maxRetries,
        debug: this.options.debug
      });

      await socketClient.connect();
      this.initialized = true;

      // Set up global error handlers
      socketClient.onConnectionChange(this.handleConnectionChange.bind(this));
      
    } catch (error) {
      console.error('[ChatService] Initialization failed:', error);
      throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to initialize chat service`);
    }
  }

  /**
   * Retrieves chat list with pagination and filtering
   * @param filters - Optional filters
   * @param pagination - Pagination options
   */
  public async getChats(
    filters: Partial<Chat> = {},
    pagination: PaginationOptions = {}
  ): Promise<{ chats: Chat[]; total: number }> {
    try {
      const response = await get<{ data: Chat[]; total: number }>(API_ENDPOINTS.CHATS, {
        params: { ...filters, ...pagination }
      });

      return {
        chats: response.data.data,
        total: response.data.total
      };
    } catch (error) {
      console.error('[ChatService] Failed to fetch chats:', error);
      throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to fetch chats`);
    }
  }

  /**
   * Sends a message with real-time delivery tracking
   * @param chatId - Chat identifier
   * @param content - Message content
   * @param type - Message type
   * @param metadata - Optional metadata
   */
  public async sendMessage(
    chatId: string,
    content: string,
    type: MessageType = MessageType.TEXT,
    metadata: Record<string, any> = {}
  ): Promise<Message> {
    try {
      const message: Partial<Message> = {
        chat_id: chatId,
        content,
        type,
        metadata,
        status: MessageStatus.SENT,
        is_ai_response: false
      };

      // Validate message
      const validation = validateMessage(message);
      if (!validation.isValid) {
        throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: ${validation.errors.join(', ')}`);
      }

      // Send through WebSocket for real-time delivery
      if (socketClient?.connected) {
        await socketClient.sendMessage(message as Message);
      }

      // Also send through REST API for persistence
      const response = await post<Message>(API_ENDPOINTS.MESSAGES, message);
      return response.data;

    } catch (error) {
      console.error('[ChatService] Failed to send message:', error);
      throw new Error(`${ERROR_CODES.MESSAGE_ERROR}: Failed to send message`);
    }
  }

  /**
   * Toggles AI assistant for a chat
   * @param chatId - Chat identifier
   * @param enabled - Enable/disable AI
   */
  public async toggleAIAssistant(chatId: string, enabled: boolean): Promise<void> {
    try {
      await patch(API_ENDPOINTS.AI_TOGGLE.replace(':id', chatId), { enabled });
    } catch (error) {
      console.error('[ChatService] Failed to toggle AI assistant:', error);
      throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to toggle AI assistant`);
    }
  }

  /**
   * Subscribes to real-time chat updates
   * @param chatId - Chat identifier
   * @param handlers - Event handlers
   */
  public async subscribeToChat(
    chatId: string,
    handlers: {
      onMessage?: (message: Message) => void;
      onTyping?: (isTyping: boolean) => void;
      onDeliveryStatus?: (status: MessageStatus) => void;
    }
  ): Promise<void> {
    if (!socketClient) {
      throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Socket not initialized`);
    }

    await socketClient.subscribeToChat(chatId, {
      enableTyping: !!handlers.onTyping,
      enableDeliveryStatus: !!handlers.onDeliveryStatus
    });

    if (handlers.onMessage) {
      socketClient.onMessage(handlers.onMessage);
    }

    if (handlers.onTyping) {
      socketClient.onTypingStatus(({ isTyping }) => handlers.onTyping?.(isTyping));
    }

    if (handlers.onDeliveryStatus) {
      socketClient.onDeliveryStatus(({ status }) => handlers.onDeliveryStatus?.(status));
    }
  }

  /**
   * Unsubscribes from chat updates
   * @param chatId - Chat identifier
   */
  public async unsubscribeFromChat(chatId: string): Promise<void> {
    if (socketClient) {
      await socketClient.unsubscribeFromChat(chatId);
    }
  }

  /**
   * Marks messages as read
   * @param messageIds - Array of message IDs
   */
  public async markMessagesAsRead(messageIds: string[]): Promise<void> {
    try {
      await post(API_ENDPOINTS.MESSAGE_STATUS, {
        message_ids: messageIds,
        status: MessageStatus.READ
      });
    } catch (error) {
      console.error('[ChatService] Failed to mark messages as read:', error);
      throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to update message status`);
    }
  }

  private handleConnectionChange(connected: boolean): void {
    if (this.options.debug) {
      console.log(`[ChatService] Connection status changed: ${connected}`);
    }
  }
}

// Export singleton instance
export const chatService = new ChatService({
  debug: process.env.NODE_ENV === 'development'
});

// Export types
export type {
  ChatServiceOptions,
  PaginationOptions,
  MessageValidation
};