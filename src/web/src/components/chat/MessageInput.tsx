import React, { useState, useRef, useCallback, useEffect } from 'react'; // ^18.0.0
import clsx from 'clsx'; // ^2.0.0
import { format } from 'date-fns-tz'; // ^2.0.0
import { Button } from '../common/Button';
import { useChat } from '../../hooks/useChat';
import { MessageType } from '../../types/chat';

// Constants for file handling and validation
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const SUPPORTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  medical_document: [
    'application/dicom',
    'application/pdf',
    'image/jpeg'
  ]
} as const;

// Error messages in Portuguese
const ERROR_MESSAGES = {
  file_too_large: 'Arquivo muito grande. Tamanho máximo: 15MB',
  invalid_type: 'Tipo de arquivo não suportado',
  offline_queued: 'Mensagem será enviada quando houver conexão',
  lgpd_compliance: 'Documento médico - conformidade LGPD aplicada'
} as const;

interface MessageInputProps {
  chatId: string;
  disabled?: boolean;
  className?: string;
  offlineMode?: boolean;
  maxFileSize?: number;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  chatId,
  disabled = false,
  className,
  offlineMode = false,
  maxFileSize = MAX_FILE_SIZE
}) => {
  // State management
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Custom hooks
  const { sendMessage, queueOfflineMessage } = useChat();

  // File validation with LGPD compliance
  const handleFileValidation = useCallback(async (file: File): Promise<boolean> => {
    // Reset previous errors
    setError(null);

    // Check file size
    if (file.size > maxFileSize) {
      setError(ERROR_MESSAGES.file_too_large);
      return false;
    }

    // Determine file type category
    let fileTypeCategory: keyof typeof SUPPORTED_MIME_TYPES | null = null;
    for (const [category, types] of Object.entries(SUPPORTED_MIME_TYPES)) {
      if (types.includes(file.type)) {
        fileTypeCategory = category as keyof typeof SUPPORTED_MIME_TYPES;
        break;
      }
    }

    if (!fileTypeCategory) {
      setError(ERROR_MESSAGES.invalid_type);
      return false;
    }

    // Special handling for medical documents (LGPD compliance)
    if (fileTypeCategory === 'medical_document') {
      console.info(ERROR_MESSAGES.lgpd_compliance);
      // Add LGPD compliance metadata
      file.name = `LGPD_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}_${file.name}`;
    }

    return true;
  }, [maxFileSize]);

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isValid = await handleFileValidation(file);
    if (!isValid) {
      event.target.value = '';
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }, [handleFileValidation]);

  // Handle message submission
  const handleSendMessage = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!message.trim() && !selectedFile) return;
    
    try {
      setIsLoading(true);
      setError(null);

      const messageType = selectedFile ? 
        selectedFile.type.startsWith('image/') ? MessageType.IMAGE : MessageType.DOCUMENT :
        MessageType.TEXT;

      const messageData = {
        content: message,
        type: messageType,
        metadata: selectedFile ? {
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          is_medical_document: messageType === MessageType.MEDICAL_DOCUMENT
        } : {}
      };

      if (offlineMode) {
        await queueOfflineMessage(chatId, messageData);
        console.info(ERROR_MESSAGES.offline_queued);
      } else {
        await sendMessage(chatId, messageData);
      }

      // Clear input and file selection
      setMessage('');
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao enviar mensagem');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, message, selectedFile, offlineMode, sendMessage, queueOfflineMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
      messageInputRef.current.style.height = `${messageInputRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <form 
      onSubmit={handleSendMessage}
      className={clsx(
        'flex flex-col gap-2 p-4 border-t border-gray-200 bg-white',
        'dark:border-gray-700 dark:bg-gray-800',
        className
      )}
    >
      {error && (
        <div className="text-sm text-red-500 dark:text-red-400 mb-2">
          {error}
        </div>
      )}

      {filePreview && (
        <div className="relative w-24 h-24 mb-2">
          <img
            src={filePreview}
            alt="Preview"
            className="w-full h-full object-cover rounded"
          />
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setFilePreview(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
          >
            <span className="sr-only">Remover arquivo</span>
            ×
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={messageInputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={disabled || isLoading}
          className={clsx(
            'flex-1 resize-none min-h-[40px] max-h-[120px] p-2 rounded-md',
            'border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
            'dark:border-gray-600 dark:bg-gray-700 dark:text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          rows={1}
        />

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept={Object.values(SUPPORTED_MIME_TYPES).flat().join(',')}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar arquivo"
        >
          <span className="sr-only">Anexar</span>
          📎
        </Button>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={disabled || isLoading || (!message.trim() && !selectedFile)}
          loading={isLoading}
        >
          Enviar
        </Button>
      </div>
    </form>
  );
};

export default MessageInput;