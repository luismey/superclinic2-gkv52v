import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import MockWebSocket from 'jest-websocket-mock';
import { jest } from '@jest/globals';

import { useChat } from '../../src/hooks/useChat';
import { chatService } from '../../src/services/chat';
import { MessageType, MessageStatus } from '../../src/types/chat';
import { createStore } from '../../src/store';

// Mock WebSocket server
let mockWebSocket: MockWebSocket;

// Mock chat service
jest.mock('../../src/services/chat', () => ({
  chatService: {
    getChat: jest.fn(),
    getChatMessages: jest.fn(),
    sendMessage: jest.fn(),
    toggleAIAssistant: jest.fn(),
    subscribeToChat: jest.fn(),
    unsubscribeFromChat: jest.fn(),
    verifyConsent: jest.fn(),
  },
}));

// Test data
const mockChat = {
  id: 'chat-123',
  customer_id: 'customer-123',
  customer_name: 'Test Customer',
  whatsapp_number: '+5511999999999',
  last_message: null,
  unread_count: 0,
  ai_enabled: false,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockMessages = [
  {
    id: 'msg-1',
    chat_id: 'chat-123',
    content: 'Test message 1',
    type: MessageType.TEXT,
    sender_id: 'user-123',
    status: MessageStatus.SENT,
    is_ai_response: false,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  },
];

describe('useChat', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mock WebSocket server
    mockWebSocket = new MockWebSocket('ws://localhost:8000');

    // Create fresh store for each test
    store = createStore();

    // Setup mock implementations
    (chatService.getChat as jest.Mock).mockResolvedValue(mockChat);
    (chatService.getChatMessages as jest.Mock).mockResolvedValue(mockMessages);
    (chatService.verifyConsent as jest.Mock).mockResolvedValue({ hasConsent: true });
  });

  afterEach(() => {
    mockWebSocket.close();
  });

  it('should initialize chat and load messages', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.chat).toBeNull();
    expect(result.current.messages).toEqual([]);

    await waitForNextUpdate();

    // Loaded state
    expect(result.current.loading).toBe(false);
    expect(result.current.chat).toEqual(mockChat);
    expect(result.current.messages).toEqual(mockMessages);
    expect(chatService.getChat).toHaveBeenCalledWith('chat-123');
    expect(chatService.getChatMessages).toHaveBeenCalledWith('chat-123', {
      limit: 50,
    });
  });

  it('should handle sending messages with offline support', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    await waitForNextUpdate();

    const message = {
      content: 'Test message',
      type: MessageType.TEXT,
    };

    // Mock successful message send
    (chatService.sendMessage as jest.Mock).mockResolvedValueOnce({
      id: 'msg-2',
      ...message,
      chat_id: 'chat-123',
      status: MessageStatus.SENT,
    });

    await act(async () => {
      await result.current.sendMessage(message);
    });

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      'chat-123',
      message.content,
      message.type,
      expect.any(Object)
    );
    expect(result.current.messages).toHaveLength(2);
  });

  it('should handle AI assistant toggle', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    await waitForNextUpdate();

    // Mock successful AI toggle
    (chatService.toggleAIAssistant as jest.Mock).mockResolvedValueOnce({
      ...mockChat,
      ai_enabled: true,
    });

    await act(async () => {
      await result.current.toggleAI();
    });

    expect(chatService.toggleAIAssistant).toHaveBeenCalledWith('chat-123', true);
    expect(result.current.chat?.ai_enabled).toBe(true);
  });

  it('should handle offline message queueing', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    await waitForNextUpdate();

    // Simulate offline state
    mockWebSocket.close();

    const message = {
      content: 'Offline message',
      type: MessageType.TEXT,
    };

    await act(async () => {
      await result.current.sendMessage(message);
    });

    expect(result.current.messageQueue).toContainEqual(
      expect.objectContaining({
        content: message.content,
        type: message.type,
        status: MessageStatus.PENDING,
      })
    );
  });

  it('should verify LGPD consent before enabling AI assistant', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    await waitForNextUpdate();

    // Mock consent verification failure
    (chatService.verifyConsent as jest.Mock).mockResolvedValueOnce({
      hasConsent: false,
    });

    await act(async () => {
      await result.current.toggleAI();
    });

    expect(chatService.verifyConsent).toHaveBeenCalledWith('chat-123');
    expect(chatService.toggleAIAssistant).not.toHaveBeenCalled();
    expect(result.current.error).toContain('LGPD consent required');
  });

  it('should handle real-time message updates', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    await waitForNextUpdate();

    const newMessage = {
      id: 'msg-3',
      chat_id: 'chat-123',
      content: 'Real-time message',
      type: MessageType.TEXT,
      status: MessageStatus.SENT,
      created_at: new Date(),
    };

    act(() => {
      mockWebSocket.send(JSON.stringify({
        type: 'message',
        payload: newMessage,
      }));
    });

    expect(result.current.messages).toContainEqual(
      expect.objectContaining(newMessage)
    );
  });

  it('should handle delivery status updates', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    await waitForNextUpdate();

    act(() => {
      mockWebSocket.send(JSON.stringify({
        type: 'status',
        payload: {
          message_id: 'msg-1',
          status: MessageStatus.DELIVERED,
        },
      }));
    });

    expect(result.current.deliveryStatus['msg-1']).toBe(MessageStatus.DELIVERED);
  });

  it('should cleanup resources on unmount', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(
      () => useChat('chat-123'),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      }
    );

    await waitForNextUpdate();

    unmount();

    expect(chatService.unsubscribeFromChat).toHaveBeenCalledWith('chat-123');
  });
});