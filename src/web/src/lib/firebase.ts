// Firebase SDK v9.0.0
import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  setPersistence, 
  browserLocalPersistence,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore,
  enableMultiTabIndexedDbPersistence,
  enablePersistence,
  PersistenceSettings,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { AuthUser, UserRole, mapFirebaseUser } from '../types/auth';
import { StorageKeys } from './storage';

/**
 * Firebase configuration interface with required fields
 * Based on Technical Specifications/2.1 High-Level Architecture
 */
interface FirebaseConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Custom error class for Firebase initialization and operations
 */
class FirebaseError extends Error {
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FirebaseError';
    this.code = code;
    Error.captureStackTrace(this, FirebaseError);
  }
  code: string;
}

/**
 * Firebase configuration from environment variables
 * Implements secure configuration management from Technical Specifications/7.2 Data Security
 */
const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

// Firebase instances
export let firebaseApp: FirebaseApp;
export let auth: Auth;
export let db: Firestore;

/**
 * Validates Firebase configuration
 * @throws {FirebaseError} If configuration is invalid or missing
 */
function validateFirebaseConfig(): void {
  const requiredFields: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  for (const field of requiredFields) {
    if (!FIREBASE_CONFIG[field]) {
      throw new FirebaseError(
        'config-missing',
        `Missing required Firebase configuration: ${field}`
      );
    }
  }
}

/**
 * Initializes Firebase with enhanced error handling and offline support
 * Implements requirements from Technical Specifications/7.1.1 Authentication Methods
 */
export async function initializeFirebase(): Promise<void> {
  try {
    // Validate configuration
    validateFirebaseConfig();

    // Initialize Firebase app if not already initialized
    if (!firebaseApp) {
      firebaseApp = initializeApp(FIREBASE_CONFIG);
    }

    // Initialize Authentication with local persistence
    auth = getAuth(firebaseApp);
    await setPersistence(auth, browserLocalPersistence);

    // Initialize Firestore with offline persistence
    const persistenceSettings: PersistenceSettings = {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    };

    db = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
      cacheSizeBytes: persistenceSettings.cacheSizeBytes
    });

    // Enable multi-tab persistence for Firestore
    try {
      await enableMultiTabIndexedDbPersistence(db);
    } catch (err) {
      if ((err as Error).name === 'FirebaseError') {
        // Fall back to single-tab persistence
        await enablePersistence(db, persistenceSettings);
      } else {
        throw err;
      }
    }

    // Set up auth state listener for token refresh
    onAuthStateChanged(auth, handleAuthStateChange);

    console.log('Firebase initialized successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new FirebaseError('init-error', `Firebase initialization failed: ${message}`);
  }
}

/**
 * Handles authentication state changes and token refresh
 * @param user - Firebase User object
 */
async function handleAuthStateChange(user: User | null): Promise<void> {
  if (user) {
    try {
      const token = await user.getIdToken();
      // Store token securely using the storage module
      localStorage.setItem(StorageKeys.AUTH_TOKEN, token);
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
  } else {
    localStorage.removeItem(StorageKeys.AUTH_TOKEN);
  }
}

/**
 * Gets the current authenticated user with enhanced token validation
 * @returns Promise resolving to AuthUser or null
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    // Get user claims and validate token
    const tokenResult = await user.getIdTokenResult(true);
    
    // Verify user role from claims
    const role = tokenResult.claims.role as UserRole;
    if (!role) {
      throw new FirebaseError('invalid-role', 'User role not found in claims');
    }

    // Map Firebase user to AuthUser type
    const authUser: AuthUser = {
      id: user.uid,
      email: user.email!,
      role,
      created_at: new Date(user.metadata.creationTime!),
      updated_at: new Date(user.metadata.lastSignInTime!),
      is_active: true,
      full_name: user.displayName || '',
      firebase_uid: user.uid,
      last_login: new Date(user.metadata.lastSignInTime!),
      mfa_enabled: user.multiFactor.enrolledFactors.length > 0
    };

    return authUser;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new FirebaseError('auth-error', `Failed to get current user: ${message}`);
  }
}

// Initialize Firebase when module is imported
if (typeof window !== 'undefined') {
  initializeFirebase().catch(console.error);
}