import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { axe } from '@axe-core/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

import ChatWindow from '../../src/components/chat/ChatWindow';
import MessageBubble from '../../src/components/chat/MessageBubble';
import AIToggle from '../../src/components/chat/AIToggle';
import { MessageType, MessageStatus } from '../../src/types/chat';

// Mock store setup
const mockStore = configureStore([]);

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock healthcare context data
const mockHealthcareData = {
  containsPatientInfo: true,
  requiresLGPDConsent: true,
  sensitiveDataTypes: ['medical_history', 'treatment_plan'],
  consentStatus: 'granted',
};

// Mock messages
const mockMessages = [
  {
    id: '1',
    chat_id: 'chat-1',
    content: 'Olá, gostaria de agendar uma consulta',
    type: MessageType.TEXT,
    sender_id: 'user-1',
    status: MessageStatus.DELIVERED,
    is_ai_response: false,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '2',
    chat_id: 'chat-1',
    content: 'Claro! Vou verificar os horários disponíveis.',
    type: MessageType.TEXT,
    sender_id: 'ai-assistant',
    status: MessageStatus.DELIVERED,
    is_ai_response: true,
    metadata: {
      ai_metadata: {
        confidence_score: 0.95,
        intent: 'schedule_appointment',
      },
    },
    created_at: new Date(),
    updated_at: new Date(),
  },
];

describe('ChatWindow Component', () => {
  let store: any;

  beforeEach(() => {
    // Reset mocks and store
    vi.clearAllMocks();
    store = mockStore({
      chat: {
        messages: mockMessages,
        loading: false,
        error: null,
        aiEnabled: true,
      },
    });

    // Mock WebSocket
    global.WebSocket = vi.fn(() => mockWebSocket) as any;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render chat window with messages', () => {
    render(
      <Provider store={store}>
        <ChatWindow chatId="chat-1" />
      </Provider>
    );

    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(mockMessages.length);
  });

  it('should handle message sending with LGPD compliance', async () => {
    render(
      <Provider store={store}>
        <ChatWindow 
          chatId="chat-1"
          healthcareContext={mockHealthcareData}
        />
      </Provider>
    );

    const input = screen.getByPlaceholderText('Digite sua mensagem...');
    const sendButton = screen.getByText('Enviar');

    fireEvent.change(input, { target: { value: 'Nova mensagem com dados sensíveis' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('LGPD_COMPLIANT')
      );
    });
  });

  it('should handle AI assistant toggle', async () => {
    render(
      <Provider store={store}>
        <ChatWindow chatId="chat-1" />
      </Provider>
    );

    const aiToggle = screen.getByRole('switch', { name: /AI Assistant/i });
    fireEvent.click(aiToggle);

    await waitFor(() => {
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: 'chat/toggleAI' })
      );
    });
  });

  it('should meet accessibility requirements', async () => {
    const { container } = render(
      <Provider store={store}>
        <ChatWindow chatId="chat-1" />
      </Provider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('MessageBubble Component', () => {
  it('should render message with healthcare data handling', () => {
    const message = {
      ...mockMessages[0],
      metadata: {
        contains_health_data: true,
        data_categories: ['medical_history'],
      },
    };

    render(
      <MessageBubble
        message={message}
        isSent={true}
        containsHealthData={true}
      />
    );

    expect(screen.getByRole('listitem')).toHaveAttribute('aria-label', 'Mensagem com dados médicos');
    expect(screen.getByTestId('health-data-indicator')).toBeInTheDocument();
  });

  it('should handle message encryption indicators', () => {
    render(
      <MessageBubble
        message={mockMessages[0]}
        isSent={true}
        isEncrypted={true}
      />
    );

    expect(screen.getByTestId('encryption-indicator')).toBeInTheDocument();
  });

  it('should display appropriate status indicators', () => {
    render(
      <MessageBubble
        message={{
          ...mockMessages[0],
          status: MessageStatus.READ,
        }}
        isSent={true}
      />
    );

    expect(screen.getByTestId('status-indicator')).toHaveTextContent('✓✓');
  });
});

describe('AIToggle Component', () => {
  it('should handle AI assistant state changes', async () => {
    const onToggle = vi.fn();

    render(
      <AIToggle
        disabled={false}
        onToggle={onToggle}
        healthcareContext={mockHealthcareData}
      />
    );

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  it('should display appropriate healthcare context indicators', () => {
    render(
      <AIToggle
        disabled={false}
        healthcareContext={mockHealthcareData}
      />
    );

    expect(screen.getByTestId('healthcare-context-indicator')).toBeInTheDocument();
  });

  it('should handle error states appropriately', async () => {
    const onError = vi.fn();

    render(
      <AIToggle
        disabled={false}
        onError={onError}
        error="Erro na configuração do assistente"
      />
    );

    expect(screen.getByText('Erro na configuração do assistente')).toBeInTheDocument();
  });
});

describe('Real-time Messaging Integration', () => {
  it('should handle WebSocket connection states', async () => {
    render(
      <Provider store={store}>
        <ChatWindow chatId="chat-1" />
      </Provider>
    );

    // Simulate WebSocket disconnection
    mockWebSocket.onclose();

    await waitFor(() => {
      expect(screen.getByText('Você está offline')).toBeInTheDocument();
    });
  });

  it('should queue messages when offline', async () => {
    render(
      <Provider store={store}>
        <ChatWindow chatId="chat-1" />
      </Provider>
    );

    // Simulate offline state
    mockWebSocket.onclose();

    const input = screen.getByPlaceholderText('Digite sua mensagem...');
    const sendButton = screen.getByText('Enviar');

    fireEvent.change(input, { target: { value: 'Mensagem offline' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: 'chat/queueOfflineMessage' })
      );
    });
  });

  it('should sync messages when connection is restored', async () => {
    render(
      <Provider store={store}>
        <ChatWindow chatId="chat-1" />
      </Provider>
    );

    // Simulate connection restoration
    mockWebSocket.onopen();

    await waitFor(() => {
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: 'chat/syncOfflineMessages' })
      );
    });
  });
});