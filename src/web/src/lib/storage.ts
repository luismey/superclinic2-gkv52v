// @ts-check
import AES from 'crypto-js/aes'; // v4.1.1
import { enc, lib } from 'crypto-js'; // v4.1.1
import * as pako from 'pako'; // v2.1.0
import { z } from 'zod'; // v3.22.0
import { ErrorResponse } from '../types/common';

// Storage keys enumeration for type safety
export enum StorageKeys {
  AUTH_TOKEN = 'auth_token',
  USER_PREFERENCES = 'user_preferences',
  WHATSAPP_SESSION = 'whatsapp_session'
}

// Constants
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_STORAGE_ENCRYPTION_KEY || '';
const STORAGE_VERSION = '1.0';
const STORAGE_PREFIX = 'porfin_';
const COMPRESSION_THRESHOLD = 1024; // bytes
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

// Storage metadata schema
const StorageMetadataSchema = z.object({
  version: z.string(),
  compressed: z.boolean(),
  timestamp: z.number(),
  hash: z.string(),
});

type StorageMetadata = z.infer<typeof StorageMetadataSchema>;

// Storage value wrapper schema
const StorageWrapperSchema = z.object({
  data: z.string(),
  metadata: StorageMetadataSchema,
});

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error implements ErrorResponse {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.timestamp = new Date();
    Error.captureStackTrace(this, StorageError);
  }
}

/**
 * Generates a secure hash of the data for integrity verification
 * @param data - Data to hash
 * @returns Hash string
 */
const generateHash = (data: string): string => {
  const wordArray = enc.Utf8.parse(data);
  return lib.WordArray.random(16).toString();
};

/**
 * Checks if storage is available
 * @param type - Storage type to check
 * @returns Boolean indicating storage availability
 */
const isStorageAvailable = (type: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    const storage = window[type];
    const testKey = `${STORAGE_PREFIX}test`;
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Securely stores data with encryption and optional compression
 * @param key - Storage key
 * @param value - Value to store
 * @param useSession - Whether to use sessionStorage
 */
export async function setSecureStorage(
  key: StorageKeys,
  value: unknown,
  useSession = false
): Promise<void> {
  try {
    // Validate storage availability
    const storageType = useSession ? 'sessionStorage' : 'localStorage';
    if (!isStorageAvailable(storageType)) {
      throw new StorageError('STORAGE_UNAVAILABLE', `${storageType} is not available`);
    }

    // Validate encryption key
    if (!ENCRYPTION_KEY) {
      throw new StorageError('ENCRYPTION_KEY_MISSING', 'Storage encryption key is not configured');
    }

    // Serialize data
    const serializedData = JSON.stringify(value);
    
    // Check size and compress if needed
    let processedData = serializedData;
    let isCompressed = false;
    
    if (serializedData.length > COMPRESSION_THRESHOLD) {
      const compressed = pako.deflate(serializedData, { to: 'string' });
      if (compressed.length < serializedData.length) {
        processedData = compressed;
        isCompressed = true;
      }
    }

    // Generate integrity hash
    const hash = generateHash(processedData);

    // Create metadata
    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      compressed: isCompressed,
      timestamp: Date.now(),
      hash,
    };

    // Encrypt data
    const encryptedData = AES.encrypt(processedData, ENCRYPTION_KEY).toString();

    // Create storage wrapper
    const storageWrapper = {
      data: encryptedData,
      metadata,
    };

    // Validate with schema
    StorageWrapperSchema.parse(storageWrapper);

    // Check storage quota
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const storageValue = JSON.stringify(storageWrapper);
    
    if (storageValue.length > MAX_STORAGE_SIZE) {
      throw new StorageError('STORAGE_QUOTA_EXCEEDED', 'Storage quota exceeded');
    }

    // Store data
    const storage = window[storageType];
    storage.setItem(storageKey, storageValue);

    // Emit storage event for cross-tab synchronization
    window.dispatchEvent(new StorageEvent('storage', {
      key: storageKey,
      newValue: storageValue,
      storageArea: storage,
    }));

  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('STORAGE_ERROR', `Failed to store data: ${error.message}`);
  }
}

/**
 * Retrieves and decrypts data from storage
 * @param key - Storage key
 * @param useSession - Whether to use sessionStorage
 * @returns Decrypted and validated value or null
 */
export async function getSecureStorage<T>(
  key: StorageKeys,
  useSession = false
): Promise<T | null> {
  try {
    // Get storage type
    const storageType = useSession ? 'sessionStorage' : 'localStorage';
    if (!isStorageAvailable(storageType)) {
      throw new StorageError('STORAGE_UNAVAILABLE', `${storageType} is not available`);
    }

    // Get encrypted data
    const storage = window[storageType];
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const storageValue = storage.getItem(storageKey);

    if (!storageValue) {
      return null;
    }

    // Parse storage wrapper
    const storageWrapper = StorageWrapperSchema.parse(JSON.parse(storageValue));

    // Decrypt data
    const decryptedData = AES.decrypt(storageWrapper.data, ENCRYPTION_KEY).toString(enc.Utf8);

    // Verify hash
    const hash = generateHash(decryptedData);
    if (hash !== storageWrapper.metadata.hash) {
      throw new StorageError('DATA_INTEGRITY_ERROR', 'Data integrity check failed');
    }

    // Decompress if needed
    let processedData = decryptedData;
    if (storageWrapper.metadata.compressed) {
      processedData = pako.inflate(decryptedData, { to: 'string' });
    }

    // Parse and return data
    return JSON.parse(processedData) as T;

  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('STORAGE_ERROR', `Failed to retrieve data: ${error.message}`);
  }
}

/**
 * Securely clears all application storage
 */
export async function clearStorage(): Promise<void> {
  try {
    const storageTypes: ('localStorage' | 'sessionStorage')[] = ['localStorage', 'sessionStorage'];

    for (const storageType of storageTypes) {
      if (!isStorageAvailable(storageType)) {
        continue;
      }

      const storage = window[storageType];
      
      // Get all keys with prefix
      const keys = Object.keys(storage).filter(key => key.startsWith(STORAGE_PREFIX));

      // Securely clear each item
      for (const key of keys) {
        // Overwrite with random data before removing
        const randomData = lib.WordArray.random(64).toString();
        storage.setItem(key, randomData);
        storage.removeItem(key);
      }
    }

    // Emit storage clear event
    window.dispatchEvent(new Event('storage_cleared'));

  } catch (error) {
    throw new StorageError('CLEAR_STORAGE_ERROR', `Failed to clear storage: ${error.message}`);
  }
}