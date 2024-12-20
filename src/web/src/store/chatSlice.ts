// @ts-check
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { 
  Chat, 
  Message, 
  MessageType, 
  MessageStatus, 
  ChatState,
  ChatEvent
} from '../types/chat';
import { chatService } from '../services/chat';
import { RootState } from './store';

// Version 1.9.5 @reduxjs/toolkit

// Initial state with comprehensive chat management
const initialState: ChatState = {
  active_chat_id: null,
  chats: {},
  messages: {},
  loading: false,
  error: null,
  metadata: {
    total_unread: 0,
    last_sync_timestamp: 0,
    active_connections: 0
  },
  delivery_status: {},
  typing_indicators: {},
  offline_queue: [],
  ai_assistant_status: {},
  websocket_status: 'disconnected'
};

// Async thunks for chat operations
export const fetchChats = createAsyncThunk(
  'chat/fetchChats',
  async ({ filters, pagination }: { 
    filters?: Partial<Chat>,
    pagination?: { page: number; page_size: number }
  }) => {
    const response = await chatService.getChats(filters, pagination);
    return response;
  }
);

export const fetchChatMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ chatId, pagination }: {
    chatId: string;
    pagination?: { page: number; page_size: number }
  }) => {
    const response = await chatService.getChatMessages(chatId, pagination);
    return { chatId, messages: response.data };
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ chatId, content, type = MessageType.TEXT, metadata = {} }: {
    chatId: string;
    content: string;
    type?: MessageType;
    metadata?: Record<string, any>;
  }) => {
    const response = await chatService.sendMessage(chatId, content, type, metadata);
    return response;
  }
);

export const toggleAIAssistant = createAsyncThunk(
  'chat/toggleAI',
  async ({ chatId, enabled }: { chatId: string; enabled: boolean }) => {
    await chatService.toggleAIAssistant(chatId, enabled);
    return { chatId, enabled };
  }
);

export const syncOfflineMessages = createAsyncThunk(
  'chat/syncOfflineMessages',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const { offline_queue } = state.chat;
    
    const results = await Promise.allSettled(
      offline_queue.map(message => 
        chatService.sendMessage(
          message.chat_id,
          message.content,
          message.type,
          message.metadata
        )
      )
    );

    return results.map((result, index) => ({
      message: offline_queue[index],
      success: result.status === 'fulfilled'
    }));
  }
);

// Chat slice with comprehensive state management
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChat: (state, action: PayloadAction<string | null>) => {
      state.active_chat_id = action.payload;
    },

    updateTypingStatus: (state, action: PayloadAction<{
      chatId: string;
      isTyping: boolean;
    }>) => {
      state.typing_indicators[action.payload.chatId] = action.payload.isTyping;
    },

    updateDeliveryStatus: (state, action: PayloadAction<{
      messageId: string;
      status: MessageStatus;
    }>) => {
      state.delivery_status[action.payload.messageId] = action.payload.status;
    },

    addToOfflineQueue: (state, action: PayloadAction<Message>) => {
      state.offline_queue.push(action.payload);
    },

    removeFromOfflineQueue: (state, action: PayloadAction<string>) => {
      state.offline_queue = state.offline_queue.filter(
        msg => msg.id !== action.payload
      );
    },

    updateWebsocketStatus: (state, action: PayloadAction<'connected' | 'disconnected'>) => {
      state.websocket_status = action.payload;
    },

    handleChatEvent: (state, action: PayloadAction<ChatEvent>) => {
      const { type, payload } = action.payload;
      
      switch (type) {
        case 'message':
          if (!state.messages[payload.chat_id]) {
            state.messages[payload.chat_id] = [];
          }
          state.messages[payload.chat_id].push(payload.data);
          break;

        case 'status':
          state.delivery_status[payload.data.message_id] = payload.data.status;
          break;

        case 'typing':
          state.typing_indicators[payload.chat_id] = payload.data.is_typing;
          break;
      }
    },

    clearChatState: (state) => {
      return { ...initialState };
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch chats
      .addCase(fetchChats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.loading = false;
        state.chats = action.payload.chats.reduce((acc, chat) => {
          acc[chat.id] = chat;
          return acc;
        }, {} as Record<string, Chat>);
        state.metadata.total_unread = action.payload.chats.reduce(
          (sum, chat) => sum + chat.unread_count, 0
        );
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch chats';
      })

      // Fetch messages
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        state.messages[action.payload.chatId] = action.payload.messages;
      })

      // Send message
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        if (!state.messages[message.chat_id]) {
          state.messages[message.chat_id] = [];
        }
        state.messages[message.chat_id].push(message);
        state.delivery_status[message.id] = MessageStatus.SENT;
      })

      // Toggle AI
      .addCase(toggleAIAssistant.fulfilled, (state, action) => {
        state.ai_assistant_status[action.payload.chatId] = action.payload.enabled;
      })

      // Sync offline messages
      .addCase(syncOfflineMessages.fulfilled, (state, action) => {
        action.payload.forEach(({ message, success }) => {
          if (success) {
            state.offline_queue = state.offline_queue.filter(
              msg => msg.id !== message.id
            );
          }
        });
      });
  }
});

// Selectors with memoization
export const selectActiveChat = createSelector(
  [(state: RootState) => state.chat.active_chat_id, (state: RootState) => state.chat.chats],
  (activeChatId, chats) => activeChatId ? chats[activeChatId] : null
);

export const selectChatMessages = createSelector(
  [(state: RootState) => state.chat.messages, (state: RootState, chatId: string) => chatId],
  (messages, chatId) => messages[chatId] || []
);

export const selectUnreadCount = createSelector(
  [(state: RootState) => state.chat.metadata.total_unread],
  (totalUnread) => totalUnread
);

export const selectTypingStatus = createSelector(
  [(state: RootState) => state.chat.typing_indicators, (state: RootState, chatId: string) => chatId],
  (typingIndicators, chatId) => typingIndicators[chatId] || false
);

export const selectOfflineQueue = createSelector(
  [(state: RootState) => state.chat.offline_queue],
  (queue) => queue
);

export const selectAIAssistantStatus = createSelector(
  [(state: RootState) => state.chat.ai_assistant_status, (state: RootState, chatId: string) => chatId],
  (aiStatus, chatId) => aiStatus[chatId] || false
);

// Export actions and reducer
export const {
  setActiveChat,
  updateTypingStatus,
  updateDeliveryStatus,
  addToOfflineQueue,
  removeFromOfflineQueue,
  updateWebsocketStatus,
  handleChatEvent,
  clearChatState
} = chatSlice.actions;

export default chatSlice.reducer;