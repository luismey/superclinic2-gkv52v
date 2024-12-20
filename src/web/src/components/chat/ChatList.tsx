import React, { useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { VariableSizeList as VirtualList } from 'react-window'; // ^1.8.9
import cn from 'classnames'; // ^2.3.2
import { format } from 'date-fns-tz'; // ^2.0.0
import { ptBR } from 'date-fns/locale'; // ^2.0.0

import { Chat, Message, MessageType, DeliveryStatus, TypingStatus, AIStatus } from '../../types/chat';
import { useChat } from '../../hooks/useChat';

// Constants for component configuration
const MESSAGE_PREVIEW_LENGTH = 50;
const CHAT_ITEM_HEIGHT = 72;
const OFFLINE_QUEUE_KEY = 'chat_offline_queue';

// Error messages in Portuguese
const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Erro de conexão. Tentando reconectar...',
  LOAD_ERROR: 'Erro ao carregar conversas. Tente novamente.',
  SEND_ERROR: 'Erro ao enviar mensagem. Mensagem salva offline.'
};

// Props interfaces
interface ChatListProps {
  className?: string;
  onChatSelect?: (chatId: string) => void;
  onAIToggle?: (chatId: string, enabled: boolean) => void;
  onError?: (error: Error) => void;
  virtualListProps?: {
    height: number;
    width: number;
    itemCount: number;
  };
}

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  onAIToggle: (enabled: boolean) => void;
  isOffline: boolean;
}

// Main ChatList component
export const ChatList: React.FC<ChatListProps> = ({
  className,
  onChatSelect,
  onAIToggle,
  onError,
  virtualListProps
}) => {
  const router = useRouter();
  const { chat, loading, error, isOffline } = useChat();
  const activeChatId = router.query.chatId as string;

  // Handle chat selection
  const handleChatSelect = useCallback((chatId: string) => {
    router.push(`/chats/${chatId}`, undefined, { shallow: true });
    onChatSelect?.(chatId);
  }, [router, onChatSelect]);

  // Handle AI assistant toggle
  const handleAIToggle = useCallback((chatId: string, enabled: boolean) => {
    onAIToggle?.(chatId, enabled);
  }, [onAIToggle]);

  // Report errors to parent
  useEffect(() => {
    if (error) {
      onError?.(new Error(error));
    }
  }, [error, onError]);

  // Virtualized list row renderer
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const chatItem = chat?.chats[index];
    if (!chatItem) return null;

    return (
      <div style={style}>
        <ChatItem
          chat={chatItem}
          isActive={chatItem.id === activeChatId}
          onClick={() => handleChatSelect(chatItem.id)}
          onAIToggle={(enabled) => handleAIToggle(chatItem.id, enabled)}
          isOffline={isOffline}
        />
      </div>
    );
  }, [chat?.chats, activeChatId, handleChatSelect, handleAIToggle, isOffline]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse">Carregando conversas...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-red-600">
        <span>{ERROR_MESSAGES.LOAD_ERROR}</span>
        <button 
          className="mt-2 text-sm text-blue-600 hover:underline"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Offline indicator */}
      {isOffline && (
        <div className="px-4 py-2 text-sm text-yellow-700 bg-yellow-50 border-b">
          {ERROR_MESSAGES.NETWORK_ERROR}
        </div>
      )}

      {/* Virtualized chat list */}
      <VirtualList
        height={virtualListProps?.height || 600}
        width={virtualListProps?.width || '100%'}
        itemCount={chat?.chats.length || 0}
        itemSize={() => CHAT_ITEM_HEIGHT}
        className="scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400"
      >
        {renderRow}
      </VirtualList>
    </div>
  );
};

// Individual chat item component
const ChatItem: React.FC<ChatItemProps> = ({
  chat,
  isActive,
  onClick,
  onAIToggle,
  isOffline
}) => {
  // Format last message timestamp
  const formattedTime = useMemo(() => {
    if (!chat.last_message?.created_at) return '';
    return format(new Date(chat.last_message.created_at), 'HH:mm', {
      locale: ptBR,
      timeZone: 'America/Sao_Paulo'
    });
  }, [chat.last_message?.created_at]);

  // Format message preview
  const messagePreview = useMemo(() => {
    const content = chat.last_message?.content || '';
    return content.length > MESSAGE_PREVIEW_LENGTH
      ? `${content.substring(0, MESSAGE_PREVIEW_LENGTH)}...`
      : content;
  }, [chat.last_message?.content]);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-center px-4 py-3 border-b cursor-pointer transition-colors',
        'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
        {
          'bg-blue-50': isActive,
          'opacity-75': isOffline
        }
      )}
      onClick={onClick}
      onKeyPress={(e) => e.key === 'Enter' && onClick()}
      aria-selected={isActive}
      aria-label={`Chat com ${chat.customer_name}`}
    >
      {/* Customer avatar/info */}
      <div className="flex-shrink-0 mr-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-lg text-gray-600">
            {chat.customer_name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Chat details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {chat.customer_name}
          </h3>
          <span className="text-xs text-gray-500">{formattedTime}</span>
        </div>

        <div className="flex items-center mt-1">
          {/* Message preview */}
          <p className="text-sm text-gray-600 truncate flex-1">
            {messagePreview}
          </p>

          {/* Status indicators */}
          <div className="flex items-center ml-2">
            {/* Unread count */}
            {chat.unread_count > 0 && (
              <span className="px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded-full">
                {chat.unread_count}
              </span>
            )}

            {/* AI status */}
            <button
              className={cn(
                'ml-2 p-1 rounded-full transition-colors',
                chat.ai_status ? 'text-green-500' : 'text-gray-400'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onAIToggle(!chat.ai_status);
              }}
              aria-label={chat.ai_status ? 'Desativar IA' : 'Ativar IA'}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </button>

            {/* LGPD consent indicator */}
            {chat.lgpd_consent && (
              <span className="ml-2 text-green-500" title="Consentimento LGPD">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatList;
```

This implementation includes:

1. Virtualized list for performance with large chat lists
2. Real-time updates through useChat hook
3. Offline support with status indicators
4. AI assistant toggle with status indicator
5. LGPD compliance indicator
6. Accessibility features (ARIA attributes, keyboard navigation)
7. Portuguese localization
8. Error handling with user-friendly messages
9. Loading states
10. Responsive design with Tailwind CSS
11. Message preview truncation
12. Timestamp formatting for Brazilian timezone
13. Unread message counter
14. Type-safe implementation with TypeScript

The component is fully integrated with the application's state management and follows all the technical specifications for the chat interface.

Usage example:
```typescript
<ChatList
  onChatSelect={(chatId) => console.log('Selected chat:', chatId)}
  onAIToggle={(chatId, enabled) => console.log('AI toggled:', chatId, enabled)}
  onError={(error) => console.error('Chat list error:', error)}
  virtualListProps={{
    height: 600,
    width: 300,
    itemCount: 100
  }}
/>