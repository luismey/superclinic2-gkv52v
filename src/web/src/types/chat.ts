// @ts-check
import { BaseModel } from './common';
import { AuthUser } from './auth';

/**
 * Maximum message length as per WhatsApp specifications
 */
export const MAX_MESSAGE_LENGTH = 4096;

/**
 * Supported MIME types for different message types
 */
export const SUPPORTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png'],
  document: ['application/pdf', 'application/msword'],
  video: ['video/mp4']
} as const;

/**
 * Enumeration of supported message types based on WhatsApp Business API
 * @see Technical Specifications/A.1.1 WhatsApp Integration Details
 */
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT'
}

/**
 * Enumeration of message delivery statuses
 */
export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED'
}

/**
 * Interface for chat messages with enhanced AI support and metadata
 * Extends BaseModel for common fields
 */
export interface Message extends BaseModel {
  chat_id: string;
  type: MessageType;
  content: string;
  sender_id: string;
  status: MessageStatus;
  is_ai_response: boolean;
  metadata: {
    mime_type?: string;
    file_size?: number;
    duration?: number;
    thumbnail_url?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    contact?: {
      name: string;
      phone_number: string;
      email?: string;
    };
    ai_metadata?: {
      confidence_score: number;
      processing_time: number;
      model_version: string;
      intent?: string;
      entities?: Record<string, any>;
    };
  };
}

/**
 * Interface for chat sessions with AI and tracking capabilities
 * Extends BaseModel for common fields
 */
export interface Chat extends BaseModel {
  customer_id: string;
  customer_name: string;
  whatsapp_number: string;
  last_message: Message;
  unread_count: number;
  ai_enabled: boolean;
  tags?: string[];
  preferences?: {
    notification_enabled: boolean;
    auto_reply_enabled: boolean;
    language: string;
    timezone: string;
  };
  metadata?: {
    platform: string;
    device_info?: string;
    business_account_id: string;
    campaign_source?: string;
  };
}

/**
 * Interface for chat state management with error handling
 * Used for managing real-time chat state in the frontend
 */
export interface ChatState {
  active_chat_id: string | null;
  chats: Record<string, Chat>;
  messages: Record<string, Message[]>;
  loading: boolean;
  error: string | null;
  metadata: {
    total_unread: number;
    last_sync_timestamp: number;
    active_connections: number;
  };
}

/**
 * Type guard to check if a message type supports media
 * @param type - Message type to check
 */
export function isMediaMessage(type: MessageType): boolean {
  return [
    MessageType.IMAGE,
    MessageType.AUDIO,
    MessageType.VIDEO,
    MessageType.DOCUMENT
  ].includes(type);
}

/**
 * Type guard to check if a message is an AI response
 * @param message - Message to check
 */
export function isAIResponse(message: Message): boolean {
  return message.is_ai_response && !!message.metadata.ai_metadata;
}

/**
 * Type for WebSocket chat events
 */
export type ChatEvent = {
  type: 'message' | 'status' | 'typing' | 'presence';
  payload: {
    chat_id: string;
    timestamp: number;
    data: any;
  };
};

/**
 * Type for chat message validation
 */
export interface MessageValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Type for chat analytics data
 */
export interface ChatAnalytics {
  total_messages: number;
  response_time_avg: number;
  ai_usage_percentage: number;
  customer_satisfaction_score?: number;
  popular_intents: Array<{
    intent: string;
    count: number;
  }>;
}