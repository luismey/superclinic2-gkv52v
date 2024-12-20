// @ts-check
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { chatService } from '../../src/services/chat';
import { SocketClient } from '../../src/lib/socket';
import { 
  Message, 
  MessageType, 
  MessageStatus, 
  Chat,
  ChatEvent 
} from '../../src/types/chat';

// Mock socket client
jest.mock('../../src/lib/socket');

// Mock API client
jest.mock('../../src/lib/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn()
}));

// Test constants
const TEST_AUTH_TOKEN = 'test-auth-token';
const TEST_CHAT_ID = 'test-chat-id';
const TEST_MESSAGE_ID = 'test-message-id';
const TEST_TIMEOUT = 5000;

describe('Chat Service Tests', () => {
  let mockSocket: jest.Mocked<SocketClient>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize mock socket
    mockSocket = new SocketClient(TEST_AUTH_TOKEN) as jest.Mocked<SocketClient>;
    (SocketClient as jest.Mock).mockImplementation(() => mockSocket);
    
    // Setup common mock implementations
    mockSocket.connect.mockResolvedValue();
    mockSocket.disconnect.mockResolvedValue();
    mockSocket.subscribeToChat.mockResolvedValue();
    mockSocket.unsubscribeFromChat.mockResolvedValue();
  });

  afterEach(async () => {
    await chatService.disconnect?.();
  });

  describe('Initialization Tests', () => {
    test('should initialize chat service with auth token', async () => {
      await chatService.initialize(TEST_AUTH_TOKEN);
      
      expect(SocketClient).toHaveBeenCalledWith(TEST_AUTH_TOKEN, expect.any(Object));
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    test('should handle connection errors gracefully', async () => {
      mockSocket.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(chatService.initialize(TEST_AUTH_TOKEN))
        .rejects
        .toThrow('CHAT_001: Failed to initialize chat service');
    });

    test('should retry connection on failure', async () => {
      mockSocket.connect
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);

      await chatService.initialize(TEST_AUTH_TOKEN);
      
      expect(mockSocket.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Message Operations Tests', () => {
    beforeEach(async () => {
      await chatService.initialize(TEST_AUTH_TOKEN);
    });

    test('should send text message successfully', async () => {
      const messageContent = 'Test message';
      mockSocket.sendMessage.mockResolvedValue();

      await chatService.sendMessage(TEST_CHAT_ID, messageContent);

      expect(mockSocket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        chat_id: TEST_CHAT_ID,
        content: messageContent,
        type: MessageType.TEXT
      }));
    });

    test('should handle media message attachments', async () => {
      const mediaContent = 'media-url';
      const metadata = {
        mime_type: 'image/jpeg',
        file_size: 1024
      };

      await chatService.sendMessage(TEST_CHAT_ID, mediaContent, MessageType.IMAGE, metadata);

      expect(mockSocket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.IMAGE,
        metadata: expect.objectContaining(metadata)
      }));
    });

    test('should queue messages when offline', async () => {
      mockSocket.connected = false;
      const messageContent = 'Offline message';

      await chatService.sendMessage(TEST_CHAT_ID, messageContent);

      // Message should be queued
      expect(mockSocket.sendMessage).not.toHaveBeenCalled();
    });

    test('should handle message delivery status updates', async () => {
      const statusHandler = jest.fn();
      mockSocket.onDeliveryStatus.mockImplementation(handler => {
        handler({ messageId: TEST_MESSAGE_ID, status: MessageStatus.DELIVERED });
      });

      await chatService.subscribeToChat(TEST_CHAT_ID, {
        onDeliveryStatus: statusHandler
      });

      expect(statusHandler).toHaveBeenCalledWith(MessageStatus.DELIVERED);
    });
  });

  describe('AI Assistant Integration Tests', () => {
    beforeEach(async () => {
      await chatService.initialize(TEST_AUTH_TOKEN);
    });

    test('should toggle AI assistant', async () => {
      await chatService.toggleAIAssistant(TEST_CHAT_ID, true);

      expect(mockSocket.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        chat_id: TEST_CHAT_ID,
        is_ai_response: true
      }));
    });

    test('should handle AI response messages', async () => {
      const messageHandler = jest.fn();
      const aiResponse: Message = {
        id: 'ai-msg-id',
        chat_id: TEST_CHAT_ID,
        content: 'AI response',
        type: MessageType.TEXT,
        sender_id: 'ai',
        status: MessageStatus.SENT,
        is_ai_response: true,
        metadata: {
          ai_metadata: {
            confidence_score: 0.95,
            processing_time: 150,
            model_version: 'gpt-4'
          }
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      mockSocket.onMessage.mockImplementation(handler => {
        handler(aiResponse);
      });

      await chatService.subscribeToChat(TEST_CHAT_ID, {
        onMessage: messageHandler
      });

      expect(messageHandler).toHaveBeenCalledWith(expect.objectContaining({
        is_ai_response: true,
        metadata: expect.objectContaining({
          ai_metadata: expect.any(Object)
        })
      }));
    });

    test('should handle typing indicators for AI responses', async () => {
      const typingHandler = jest.fn();
      mockSocket.onTypingStatus.mockImplementation(handler => {
        handler({ chatId: TEST_CHAT_ID, isTyping: true });
      });

      await chatService.subscribeToChat(TEST_CHAT_ID, {
        onTyping: typingHandler
      });

      expect(typingHandler).toHaveBeenCalledWith(true);
    });
  });

  describe('Real-time Communication Tests', () => {
    beforeEach(async () => {
      await chatService.initialize(TEST_AUTH_TOKEN);
    });

    test('should handle WebSocket reconnection', async () => {
      // Simulate disconnect
      mockSocket.emit('disconnect');
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSocket.connect).toHaveBeenCalledTimes(2);
    });

    test('should maintain message order during reconnection', async () => {
      const messages: Message[] = [];
      mockSocket.onMessage.mockImplementation(handler => {
        messages.forEach(msg => handler(msg));
      });

      // Simulate messages during offline period
      mockSocket.connected = false;
      await chatService.sendMessage(TEST_CHAT_ID, 'Message 1');
      await chatService.sendMessage(TEST_CHAT_ID, 'Message 2');

      // Reconnect and process queue
      mockSocket.connected = true;
      mockSocket.emit('connect');

      expect(messages.map(m => m.content)).toEqual(['Message 1', 'Message 2']);
    });

    test('should handle concurrent chat subscriptions', async () => {
      const chatIds = ['chat1', 'chat2', 'chat3'];
      
      await Promise.all(chatIds.map(chatId => 
        chatService.subscribeToChat(chatId)
      ));

      chatIds.forEach(chatId => {
        expect(mockSocket.subscribeToChat).toHaveBeenCalledWith(
          chatId,
          expect.any(Object)
        );
      });
    });
  });

  describe('Error Handling Tests', () => {
    beforeEach(async () => {
      await chatService.initialize(TEST_AUTH_TOKEN);
    });

    test('should handle invalid message content', async () => {
      const longMessage = 'a'.repeat(4097); // Exceeds MAX_MESSAGE_LENGTH

      await expect(chatService.sendMessage(TEST_CHAT_ID, longMessage))
        .rejects
        .toThrow('CHAT_004: Message exceeds maximum length');
    });

    test('should handle unsupported media types', async () => {
      const invalidMetadata = {
        mime_type: 'invalid/type'
      };

      await expect(
        chatService.sendMessage(TEST_CHAT_ID, 'content', MessageType.IMAGE, invalidMetadata)
      ).rejects.toThrow('CHAT_004: Unsupported mime type');
    });

    test('should handle network errors during message send', async () => {
      mockSocket.sendMessage.mockRejectedValue(new Error('Network error'));

      await expect(chatService.sendMessage(TEST_CHAT_ID, 'test'))
        .rejects
        .toThrow('CHAT_003: Failed to send message');
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await chatService.initialize(TEST_AUTH_TOKEN);
    });

    test('should handle rapid message sending', async () => {
      const messages = Array(100).fill('test message');
      
      const startTime = Date.now();
      await Promise.all(messages.map(msg => 
        chatService.sendMessage(TEST_CHAT_ID, msg)
      ));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(TEST_TIMEOUT);
    });

    test('should handle large message history', async () => {
      const mockMessages = Array(1000).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        chat_id: TEST_CHAT_ID,
        content: `Message ${i}`,
        type: MessageType.TEXT,
        sender_id: 'user',
        status: MessageStatus.SENT,
        is_ai_response: false,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      }));

      const startTime = Date.now();
      mockSocket.onMessage.mockImplementation(handler => {
        mockMessages.forEach(msg => handler(msg));
      });

      await chatService.subscribeToChat(TEST_CHAT_ID, {
        onMessage: () => {}
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(TEST_TIMEOUT);
    });
  });
});