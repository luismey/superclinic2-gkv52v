// @ts-check
import { io, Socket } from 'socket.io-client'; // ^4.7.0
import { EventEmitter } from 'events'; // ^3.3.0
import { Message, MessageStatus, ChatEvent } from '../types/chat';

// Socket configuration constants
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:8000';
const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000;
const MAX_QUEUE_SIZE = 1000;
const BACKOFF_MULTIPLIER = 1.5;

/**
 * Interface for pending messages in the offline queue
 */
interface PendingMessage {
  id: string;
  chatId: string;
  content: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Interface for socket client options
 */
interface SocketOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

/**
 * Interface for chat subscription options
 */
interface SubscriptionOptions {
  enableTyping?: boolean;
  enableDeliveryStatus?: boolean;
  enablePresence?: boolean;
}

/**
 * Enhanced WebSocket client class for real-time chat functionality
 * Implements requirements from Technical Specifications/3.3.1 API Architecture
 */
export class SocketClient {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private eventEmitter: EventEmitter;
  private authToken: string | null;
  private messageQueue: PendingMessage[] = [];
  private typingStatus: Map<string, boolean> = new Map();
  private deliveryStatus: Map<string, MessageStatus> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private debug: boolean;

  /**
   * Initialize the socket client with enhanced features
   * @param authToken - JWT authentication token
   * @param options - Socket configuration options
   */
  constructor(
    authToken: string | null,
    private options: SocketOptions = {}
  ) {
    this.authToken = authToken;
    this.eventEmitter = new EventEmitter();
    this.debug = options.debug || false;
    
    // Set default options
    this.options = {
      autoReconnect: true,
      reconnectDelay: RECONNECT_DELAY,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval: HEARTBEAT_INTERVAL,
      ...options
    };
  }

  /**
   * Establish WebSocket connection with enhanced reliability
   */
  public async connect(): Promise<void> {
    if (this.socket?.connected) return;

    try {
      this.socket = io(SOCKET_URL, {
        auth: {
          token: this.authToken
        },
        transports: ['websocket'],
        reconnection: false, // We handle reconnection manually
        timeout: 10000,
        forceNew: true,
        compress: true
      });

      // Set up connection event handlers
      this.socket.on('connect', this.handleConnect.bind(this));
      this.socket.on('disconnect', this.handleDisconnect.bind(this));
      this.socket.on('error', this.handleError.bind(this));
      this.socket.on('chat_event', this.handleChatEvent.bind(this));

      // Set up heartbeat mechanism
      this.setupHeartbeat();

    } catch (error) {
      this.logError('Connection error:', error);
      this.handleReconnection();
    }
  }

  /**
   * Gracefully disconnect the WebSocket connection
   */
  public async disconnect(): Promise<void> {
    this.clearHeartbeat();
    this.connected = false;
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.eventEmitter.emit('connectionChange', false);
  }

  /**
   * Subscribe to chat events with enhanced features
   * @param chatId - Chat identifier
   * @param options - Subscription options
   */
  public async subscribeToChat(
    chatId: string,
    options: SubscriptionOptions = {}
  ): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('subscribe_chat', { chatId, options });

    // Set up chat-specific event handlers
    if (options.enableTyping) {
      this.socket.on(`typing:${chatId}`, this.handleTypingStatus.bind(this));
    }

    if (options.enableDeliveryStatus) {
      this.socket.on(`delivery:${chatId}`, this.handleDeliveryStatus.bind(this));
    }

    if (options.enablePresence) {
      this.socket.on(`presence:${chatId}`, this.handlePresence.bind(this));
    }
  }

  /**
   * Unsubscribe from chat events
   * @param chatId - Chat identifier
   */
  public async unsubscribeFromChat(chatId: string): Promise<void> {
    if (!this.socket?.connected) return;

    this.socket.emit('unsubscribe_chat', { chatId });
    this.socket.off(`typing:${chatId}`);
    this.socket.off(`delivery:${chatId}`);
    this.socket.off(`presence:${chatId}`);
  }

  /**
   * Send a message with offline support and delivery tracking
   * @param message - Message to send
   */
  public async sendMessage(message: Message): Promise<void> {
    if (!this.socket?.connected) {
      this.queueMessage(message);
      return;
    }

    try {
      this.socket.emit('send_message', message);
      this.deliveryStatus.set(message.id, MessageStatus.SENT);
      this.eventEmitter.emit('deliveryStatus', {
        messageId: message.id,
        status: MessageStatus.SENT
      });
    } catch (error) {
      this.logError('Send message error:', error);
      this.queueMessage(message);
    }
  }

  /**
   * Set typing status for a chat
   * @param chatId - Chat identifier
   * @param isTyping - Typing status
   */
  public setTypingStatus(chatId: string, isTyping: boolean): void {
    if (!this.socket?.connected) return;

    this.socket.emit('typing_status', { chatId, isTyping });
    this.typingStatus.set(chatId, isTyping);
  }

  /**
   * Register message event handler
   * @param handler - Message event handler function
   */
  public onMessage(handler: (message: Message) => void): void {
    this.eventEmitter.on('message', handler);
  }

  /**
   * Register connection change handler
   * @param handler - Connection change handler function
   */
  public onConnectionChange(handler: (connected: boolean) => void): void {
    this.eventEmitter.on('connectionChange', handler);
  }

  /**
   * Register typing status handler
   * @param handler - Typing status handler function
   */
  public onTypingStatus(
    handler: (data: { chatId: string; isTyping: boolean }) => void
  ): void {
    this.eventEmitter.on('typingStatus', handler);
  }

  /**
   * Register delivery status handler
   * @param handler - Delivery status handler function
   */
  public onDeliveryStatus(
    handler: (data: { messageId: string; status: MessageStatus }) => void
  ): void {
    this.eventEmitter.on('deliveryStatus', handler);
  }

  // Private helper methods

  private handleConnect(): void {
    this.connected = true;
    this.reconnectAttempts = 0;
    this.eventEmitter.emit('connectionChange', true);
    this.processMessageQueue();
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.eventEmitter.emit('connectionChange', false);
    this.handleReconnection();
  }

  private handleError(error: Error): void {
    this.logError('Socket error:', error);
    this.eventEmitter.emit('error', error);
  }

  private handleChatEvent(event: ChatEvent): void {
    switch (event.type) {
      case 'message':
        this.eventEmitter.emit('message', event.payload.data);
        break;
      case 'status':
        this.handleDeliveryStatus(event.payload.data);
        break;
      case 'typing':
        this.handleTypingStatus(event.payload.data);
        break;
      case 'presence':
        this.handlePresence(event.payload.data);
        break;
    }
  }

  private handleTypingStatus(data: { chatId: string; isTyping: boolean }): void {
    this.typingStatus.set(data.chatId, data.isTyping);
    this.eventEmitter.emit('typingStatus', data);
  }

  private handleDeliveryStatus(
    data: { messageId: string; status: MessageStatus }
  ): void {
    this.deliveryStatus.set(data.messageId, data.status);
    this.eventEmitter.emit('deliveryStatus', data);
  }

  private handlePresence(data: { chatId: string; online: boolean }): void {
    this.eventEmitter.emit('presence', data);
  }

  private async handleReconnection(): Promise<void> {
    if (
      !this.options.autoReconnect ||
      this.reconnectAttempts >= (this.options.maxReconnectAttempts || MAX_RECONNECT_ATTEMPTS)
    ) {
      return;
    }

    const delay = (this.options.reconnectDelay || RECONNECT_DELAY) *
      Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempts);

    this.reconnectAttempts++;

    await new Promise(resolve => setTimeout(resolve, delay));
    this.connect();
  }

  private setupHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, this.options.heartbeatInterval || HEARTBEAT_INTERVAL);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private queueMessage(message: Message): void {
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      this.messageQueue.shift(); // Remove oldest message if queue is full
    }

    this.messageQueue.push({
      id: message.id,
      chatId: message.chat_id,
      content: message.content,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  private async processMessageQueue(): Promise<void> {
    if (!this.socket?.connected || this.messageQueue.length === 0) return;

    const pendingMessages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of pendingMessages) {
      try {
        await this.sendMessage({
          id: message.id,
          chat_id: message.chatId,
          content: message.content,
          type: 'TEXT',
          sender_id: '',
          status: MessageStatus.SENT,
          is_ai_response: false,
          metadata: {}
        } as Message);
      } catch (error) {
        if (message.retryCount < 3) {
          message.retryCount++;
          this.messageQueue.push(message);
        }
      }
    }
  }

  private logError(message: string, error: unknown): void {
    if (this.debug) {
      console.error(`[SocketClient] ${message}`, error);
    }
  }
}