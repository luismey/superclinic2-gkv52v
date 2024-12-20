'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { format } from 'date-fns-tz';

import ChatList from '../../../components/chat/ChatList';
import { useChat } from '../../../hooks/useChat';
import { setActiveChat, updateTypingStatus, handleChatEvent } from '../../../store/chatSlice';
import { Message, MessageType, MessageStatus } from '../../../types/chat';

/**
 * Main chat page component for healthcare professionals
 * Implements real-time messaging with WhatsApp integration and LGPD compliance
 */
const ChatsPage: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const [isBusinessHours, setIsBusinessHours] = useState(true);

  // Initialize chat hook with offline support
  const {
    chat,
    messages,
    loading,
    error,
    sendMessage,
    toggleAI,
    isOffline,
    retryFailedMessages,
    aiEnabled
  } = useChat();

  /**
   * Checks if current time is within Brazilian business hours
   * @returns boolean indicating if within business hours
   */
  const checkBusinessHours = useCallback(() => {
    const now = new Date();
    const brazilTime = format(now, 'HH:mm', { timeZone: 'America/Sao_Paulo' });
    const [hours, minutes] = brazilTime.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;

    // Business hours: 9:00 - 18:00 BRT
    const businessStart = 9 * 60;
    const businessEnd = 18 * 60;

    return timeInMinutes >= businessStart && timeInMinutes <= businessEnd;
  }, []);

  /**
   * Handles chat selection with enhanced error handling
   * @param chatId - Selected chat ID
   */
  const handleChatSelect = useCallback(async (chatId: string) => {
    try {
      // Check business hours for non-emergency communication
      const withinHours = checkBusinessHours();
      setIsBusinessHours(withinHours);

      // Update active chat in store
      dispatch(setActiveChat(chatId));

      // Navigate to chat detail view
      router.push(`/chats/${chatId}`);

    } catch (error) {
      console.error('Error selecting chat:', error);
    }
  }, [router, dispatch, checkBusinessHours]);

  /**
   * Handles AI assistant toggle with LGPD compliance
   * @param chatId - Chat ID
   * @param enabled - AI assistant enabled state
   */
  const handleAIToggle = useCallback(async (chatId: string, enabled: boolean) => {
    try {
      await toggleAI();
      
      // Update typing indicator for AI transitions
      dispatch(updateTypingStatus({ 
        chatId, 
        isTyping: enabled 
      }));

      // Log AI usage for compliance
      dispatch(handleChatEvent({
        type: 'ai_toggle',
        payload: {
          chat_id: chatId,
          timestamp: Date.now(),
          data: { enabled }
        }
      }));

    } catch (error) {
      console.error('Error toggling AI assistant:', error);
    }
  }, [dispatch, toggleAI]);

  // Retry failed messages when connection is restored
  useEffect(() => {
    if (!isOffline && chat?.offline_queue?.length > 0) {
      retryFailedMessages();
    }
  }, [isOffline, chat?.offline_queue?.length, retryFailedMessages]);

  // Check business hours periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBusinessHours(checkBusinessHours());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [checkBusinessHours]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Business hours warning */}
      {!isBusinessHours && (
        <div className="px-4 py-2 text-sm text-yellow-700 bg-yellow-50 border-b">
          Fora do horário comercial. Mensagens podem ter resposta atrasada.
        </div>
      )}

      {/* LGPD compliance notice */}
      <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b">
        Comunicações protegidas conforme LGPD. Dados sensíveis de saúde são criptografados.
      </div>

      {/* Main chat list */}
      <ChatList
        className="flex-1"
        onChatSelect={handleChatSelect}
        onAIToggle={handleAIToggle}
        offlineMode={isOffline}
      />

      {/* Offline mode indicator */}
      {isOffline && (
        <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-t">
          Modo offline. Mensagens serão enviadas quando a conexão for restaurada.
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-t">
          Erro: {error}
        </div>
      )}
    </div>
  );
};

export default ChatsPage;