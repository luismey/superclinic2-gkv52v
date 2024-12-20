// @ts-check
import { z } from 'zod'; // v3.22.0
import { 
  StorageKeys, 
  StorageError, 
  setSecureStorage, 
  getSecureStorage 
} from '../lib/storage';
import { ErrorResponse } from '../types/common';

// Constants for storage management
const STORAGE_CHANGE_EVENT = 'storage-changed' as const;
const STORAGE_VERSION = '1.0' as const;
const COMPRESSION_THRESHOLD = 1024 * 50; // 50KB
const MAX_STORAGE_SIZE = 1024 * 1024 * 5; // 5MB

// Type definitions for storage data
interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
  timezone: string;
}

interface WhatsAppSession {
  sessionId: string;
  deviceId: string;
  expiresAt: number;
  metadata: Record<string, unknown>;
}

// Zod schemas for runtime validation
const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']),
  language: z.string(),
  notifications: z.boolean(),
  timezone: z.string(),
});

const whatsAppSessionSchema = z.object({
  sessionId: z.string(),
  deviceId: z.string(),
  expiresAt: z.number(),
  metadata: z.record(z.unknown()),
});

/**
 * Decorator for storage operation validation and monitoring
 */
function validateStorage(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      console.error(`Storage operation failed: ${propertyKey}`, error);
      throw error instanceof StorageError ? error : new StorageError(
        'STORAGE_OPERATION_FAILED',
        `Failed to execute ${propertyKey}: ${error.message}`
      );
    }
  };
}

/**
 * Sets user preferences with validation and change notification
 * @param preferences - User preferences object
 */
@validateStorage
export async function setUserPreferences(preferences: UserPreferences): Promise<void> {
  try {
    // Validate preferences structure
    const validatedPrefs = userPreferencesSchema.parse(preferences);

    // Store preferences securely
    await setSecureStorage(
      StorageKeys.USER_PREFERENCES,
      validatedPrefs,
      false // Use localStorage for persistence
    );

    // Notify preference changes
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, {
      detail: {
        key: StorageKeys.USER_PREFERENCES,
        value: validatedPrefs,
        timestamp: Date.now(),
      },
    }));
  } catch (error) {
    throw new StorageError(
      'USER_PREFERENCES_ERROR',
      `Failed to save user preferences: ${error.message}`
    );
  }
}

/**
 * Retrieves user preferences with validation
 * @returns User preferences or null if not found
 */
@validateStorage
export async function getUserPreferences(): Promise<UserPreferences | null> {
  try {
    const preferences = await getSecureStorage<UserPreferences>(
      StorageKeys.USER_PREFERENCES,
      false
    );

    if (!preferences) {
      return null;
    }

    // Validate retrieved data
    return userPreferencesSchema.parse(preferences);
  } catch (error) {
    throw new StorageError(
      'USER_PREFERENCES_ERROR',
      `Failed to retrieve user preferences: ${error.message}`
    );
  }
}

/**
 * Securely stores authentication token
 * @param token - Authentication token
 */
@validateStorage
export async function setAuthToken(token: string): Promise<void> {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token format');
    }

    await setSecureStorage(
      StorageKeys.AUTH_TOKEN,
      token,
      true // Use sessionStorage for security
    );
  } catch (error) {
    throw new StorageError(
      'AUTH_TOKEN_ERROR',
      `Failed to store auth token: ${error.message}`
    );
  }
}

/**
 * Retrieves stored authentication token
 * @returns Authentication token or null if not found
 */
@validateStorage
export async function getAuthToken(): Promise<string | null> {
  try {
    return await getSecureStorage<string>(
      StorageKeys.AUTH_TOKEN,
      true // Use sessionStorage for security
    );
  } catch (error) {
    throw new StorageError(
      'AUTH_TOKEN_ERROR',
      `Failed to retrieve auth token: ${error.message}`
    );
  }
}

/**
 * Stores WhatsApp session data securely
 * @param session - WhatsApp session object
 */
@validateStorage
export async function setWhatsAppSession(session: WhatsAppSession): Promise<void> {
  try {
    // Validate session data
    const validatedSession = whatsAppSessionSchema.parse(session);

    // Add version metadata
    const sessionWithMeta = {
      ...validatedSession,
      version: STORAGE_VERSION,
      updatedAt: Date.now(),
    };

    await setSecureStorage(
      StorageKeys.WHATSAPP_SESSION,
      sessionWithMeta,
      true // Use sessionStorage for security
    );
  } catch (error) {
    throw new StorageError(
      'WHATSAPP_SESSION_ERROR',
      `Failed to store WhatsApp session: ${error.message}`
    );
  }
}

/**
 * Retrieves WhatsApp session data
 * @returns WhatsApp session or null if not found
 */
@validateStorage
export async function getWhatsAppSession(): Promise<WhatsAppSession | null> {
  try {
    const session = await getSecureStorage<WhatsAppSession & { version: string }>(
      StorageKeys.WHATSAPP_SESSION,
      true
    );

    if (!session) {
      return null;
    }

    // Version check for potential migrations
    if (session.version !== STORAGE_VERSION) {
      console.warn('WhatsApp session version mismatch');
      // Handle version migration if needed
    }

    return whatsAppSessionSchema.parse(session);
  } catch (error) {
    throw new StorageError(
      'WHATSAPP_SESSION_ERROR',
      `Failed to retrieve WhatsApp session: ${error.message}`
    );
  }
}

// Event listener for storage changes
window.addEventListener('storage', (event) => {
  if (event.key?.startsWith('porfin_')) {
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, {
      detail: {
        key: event.key,
        oldValue: event.oldValue,
        newValue: event.newValue,
        timestamp: Date.now(),
      },
    }));
  }
});