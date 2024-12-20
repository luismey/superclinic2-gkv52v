import React, { useEffect, useRef, useCallback, useState } from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import { useVirtual } from 'react-virtual'; // ^3.0.0

import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { useChat } from '../../hooks/useChat';
import { Message, MessageStatus } from '../../types/chat';
import { Loading } from '../common/Loading';

interface ChatWindowProps {
  chatId: string;
  className?: string;
  onError?: (error: Error) => void;
}

/**
 * A WhatsApp-style chat interface component with real-time messaging,
 * AI assistant integration, and LGPD compliance for healthcare data.
 */
const ChatWindow: React.FC<ChatWindowProps> = ({
  chatId,
  className,
  onError
}) => {
  // Refs for container and scroll management
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  const scrollPositionRef = useRef<number>(0);

  // Local state for UI management
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Chat hook for message management and real-time updates
  const {
    chat,
    messages,
    loading,
    error,
    sendMessage,
    toggleAI,
    deliveryStatus,
    isOffline,
    retryFailedMessages,
    aiEnabled
  } = useChat(chatId);

  // Virtual list for performance optimization
  const rowVirtualizer = useVirtual({
    size: messages.length,
    parentRef: messageContainerRef,
    estimateSize: useCallback(() => 80, []),
    overscan: 10
  });

  // Handle scroll behavior
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    
    setIsScrolledToBottom(isBottom);
    setShowScrollButton(!isBottom);
    scrollPositionRef.current = scrollTop;
  }, []);

  // Scroll to bottom with position preservation
  const scrollToBottom = useCallback((options: { smooth?: boolean; force?: boolean } = {}) => {
    if (!messageContainerRef.current) return;

    const container = messageContainerRef.current;
    const shouldScroll = options.force || isScrolledToBottom;

    if (shouldScroll) {
      const scrollOptions: ScrollToOptions = {
        top: container.scrollHeight,
        behavior: options.smooth ? 'smooth' : 'auto'
      };
      container.scrollTo(scrollOptions);
    }
  }, [isScrolledToBottom]);

  // Handle new messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage.id !== lastMessageRef.current) {
        lastMessageRef.current = lastMessage.id;
        scrollToBottom({ smooth: true });
      }
    }
  }, [messages, scrollToBottom]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(new Error(error));
    }
  }, [error, onError]);

  // Retry failed messages when coming online
  useEffect(() => {
    if (!isOffline) {
      retryFailedMessages();
    }
  }, [isOffline, retryFailedMessages]);

  // Render message list
  const renderMessages = () => {
    return rowVirtualizer.virtualItems.map(virtualRow => {
      const message = messages[virtualRow.index];
      return (
        <div
          key={virtualRow.index}
          ref={virtualRow.measureRef}
          style={{
            transform: `translateY(${virtualRow.start}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
          }}
        >
          <MessageBubble
            message={message}
            isSent={message.sender_id === 'current_user'}
            onRetry={() => retryFailedMessages()}
          />
        </div>
      );
    });
  };

  return (
    <div 
      className={clsx(
        'flex flex-col h-full bg-gray-50 dark:bg-gray-900',
        'rounded-lg overflow-hidden shadow-lg',
        className
      )}
    >
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {chat?.customer_name || 'Chat'}
          </h2>
          {chat?.ai_enabled && (
            <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-full dark:text-blue-400 dark:bg-blue-900">
              AI Enabled
            </span>
          )}
        </div>
        <button
          onClick={() => toggleAI()}
          className={clsx(
            'px-3 py-1 text-sm font-medium rounded-full transition-colors',
            aiEnabled
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          )}
        >
          AI Assistant {aiEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Message container */}
      <div
        ref={messageContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ height: '100%', position: 'relative' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loading size="lg" />
          </div>
        ) : (
          <div style={{ height: `${rowVirtualizer.totalSize}px`, position: 'relative' }}>
            {renderMessages()}
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom({ smooth: true, force: true })}
          className="absolute bottom-20 right-4 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg"
          aria-label="Scroll to bottom"
        >
          ↓
        </button>
      )}

      {/* Message input */}
      <MessageInput
        chatId={chatId}
        disabled={loading || isOffline}
        onAttachmentUpload={(file) => {
          // Handle file upload with LGPD compliance
          console.log('File upload:', file);
        }}
      />

      {/* Offline indicator */}
      {isOffline && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-sm text-center">
          You are offline. Messages will be sent when connection is restored.
        </div>
      )}
    </div>
  );
};

export default ChatWindow;