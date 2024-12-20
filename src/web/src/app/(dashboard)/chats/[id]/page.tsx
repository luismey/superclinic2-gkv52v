'use client';

import React, { useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import clsx from 'clsx';

// Components
import ChatWindow from '@/components/chat/ChatWindow';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Loading } from '@/components/common/Loading';

// Hooks
import { useChat } from '@/hooks/useChat';

// Store actions
import { setActiveChat } from '@/store/chatSlice';

// Types
interface ChatPageProps {
  params: {
    id: string;
  };
}

/**
 * Chat page component displaying individual chat conversations with real-time
 * messaging and AI assistant integration. Implements WhatsApp-style interface
 * with comprehensive security and accessibility features.
 */
const ChatPage: React.FC<ChatPageProps> = ({ params }) => {
  const dispatch = useDispatch();
  const { id: chatId } = params;

  // Initialize chat state and WebSocket connection
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

  // Set active chat in global state
  useEffect(() => {
    dispatch(setActiveChat(chatId));
    return () => {
      dispatch(setActiveChat(null));
    };
  }, [chatId, dispatch]);

  // Handle chat errors
  const handleError = useCallback((error: Error) => {
    console.error('Chat error:', error);
    // Implement error notification here
  }, []);

  // Handle AI assistant toggle
  const handleAIToggle = useCallback(async () => {
    try {
      await toggleAI();
    } catch (error) {
      handleError(error as Error);
    }
  }, [toggleAI]);

  // Retry failed messages when coming online
  useEffect(() => {
    if (!isOffline) {
      retryFailedMessages();
    }
  }, [isOffline, retryFailedMessages]);

  return (
    <DashboardLayout>
      <div 
        className={clsx(
          'h-[calc(100vh-4rem)]',
          'bg-gray-50 dark:bg-gray-900',
          'rounded-lg overflow-hidden shadow-lg'
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loading 
              size="lg"
              text="Carregando conversa..."
              aria-label="Carregando conversa"
            />
          </div>
        ) : error ? (
          <div 
            className="flex flex-col items-center justify-center h-full p-4 text-center"
            role="alert"
            aria-live="polite"
          >
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Erro ao carregar conversa
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <ChatWindow
            chatId={chatId}
            onError={handleError}
            className="h-full"
          />
        )}
      </div>
    </DashboardLayout>
  );
};

// Metadata for Next.js
export const metadata = {
  title: 'Chat | Porfin',
  description: 'Gerenciamento de conversas WhatsApp',
};

// Export configuration for dynamic routes
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export default ChatPage;