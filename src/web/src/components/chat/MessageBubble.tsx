import React from 'react'; // ^18.0.0
import cn from 'classnames'; // ^2.3.2
import { format } from 'date-fns/format'; // ^2.30.0
import { ptBR } from 'date-fns/locale/pt-BR'; // ^2.30.0

import { Message, MessageType, MessageStatus } from '../../types/chat';
import { Loading } from '../common/Loading';
import { COLORS, TRANSITIONS, BORDER_RADIUS } from '../../constants/ui';

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  className?: string;
  onRetry?: (messageId: string) => void;
  onMediaLoad?: (messageId: string) => void;
}

/**
 * Renders a chat message bubble with support for different message types,
 * delivery status indicators, and AI responses.
 */
const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
  message,
  isSent,
  className,
  onRetry,
  onMediaLoad
}) => {
  // Determine bubble styling based on sender and AI status
  const bubbleStyles = cn(
    'relative max-w-[75%] rounded-2xl px-4 py-2 mb-2',
    'break-words text-sm transition-all',
    {
      'ml-auto bg-primary-500 text-white': isSent,
      'bg-gray-100 dark:bg-gray-800': !isSent,
      'border-2 border-blue-200 dark:border-blue-800': message.is_ai_response,
      'opacity-70': message.status === MessageStatus.FAILED,
    },
    className
  );

  // Status indicator styles
  const statusStyles = cn(
    'text-xs text-gray-500 dark:text-gray-400 mt-1',
    {
      'text-right': isSent,
      'text-left': !isSent,
    }
  );

  // Format timestamp with Brazilian locale
  const formattedTime = format(message.timestamp, 'HH:mm', { locale: ptBR });

  // Render message content based on type
  const renderMessageContent = () => {
    switch (message.type) {
      case MessageType.TEXT:
        return (
          <p className="whitespace-pre-wrap">
            {message.content}
          </p>
        );

      case MessageType.IMAGE:
        return (
          <div className="relative">
            <img
              src={message.content}
              alt="Image message"
              className="rounded-lg max-w-full"
              loading="lazy"
              onLoad={() => onMediaLoad?.(message.id)}
              onError={(e) => {
                e.currentTarget.src = '/images/image-error.svg';
              }}
            />
            {!message.metadata.loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <Loading size="sm" color={COLORS.light.primary} />
              </div>
            )}
          </div>
        );

      case MessageType.DOCUMENT:
        return (
          <div className="flex items-center gap-2 p-2 bg-white/10 rounded-lg">
            <svg className="w-6 h-6" /* Document icon SVG */ />
            <span className="flex-1 truncate">
              {message.metadata.file_name || 'Document'}
            </span>
            <a
              href={message.content}
              download
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Download document"
            >
              <svg className="w-4 h-4" /* Download icon SVG */ />
            </a>
          </div>
        );

      case MessageType.AUDIO:
        return (
          <audio
            controls
            className="max-w-full"
            onLoadedData={() => onMediaLoad?.(message.id)}
          >
            <source src={message.content} type={message.metadata.mime_type} />
            Your browser does not support the audio element.
          </audio>
        );

      case MessageType.VIDEO:
        return (
          <div className="relative">
            <video
              controls
              className="rounded-lg max-w-full"
              poster={message.metadata.thumbnail_url}
              onLoadedData={() => onMediaLoad?.(message.id)}
            >
              <source src={message.content} type={message.metadata.mime_type} />
              Your browser does not support the video element.
            </video>
            {!message.metadata.loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <Loading size="sm" color={COLORS.light.primary} />
              </div>
            )}
          </div>
        );

      default:
        return <p>Unsupported message type</p>;
    }
  };

  return (
    <div
      className={bubbleStyles}
      role="listitem"
      aria-label={`${isSent ? 'Sent' : 'Received'} message`}
    >
      {/* Message content */}
      {renderMessageContent()}

      {/* Status and timestamp */}
      <div className={statusStyles}>
        <span className="mr-2">{formattedTime}</span>
        {isSent && (
          <>
            {message.status === MessageStatus.FAILED ? (
              <button
                onClick={() => onRetry?.(message.id)}
                className="text-red-500 hover:text-red-600 transition-colors"
                aria-label="Retry sending message"
              >
                Retry
              </button>
            ) : (
              <span aria-label={`Message ${message.status.toLowerCase()}`}>
                {message.status === MessageStatus.SENT && '✓'}
                {message.status === MessageStatus.DELIVERED && '✓✓'}
                {message.status === MessageStatus.READ && (
                  <span className="text-blue-500">✓✓</span>
                )}
              </span>
            )}
          </>
        )}
      </div>

      {/* AI response indicator */}
      {message.is_ai_response && (
        <span
          className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full"
          aria-label="AI response"
        >
          AI
        </span>
      )}
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;