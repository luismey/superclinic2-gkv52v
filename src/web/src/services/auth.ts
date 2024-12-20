// @ts-check
import { z } from 'zod'; // v3.0.0
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'; // v9.0.0

import { 
  AuthUser, 
  LoginCredentials, 
  RegisterData, 
  AuthTokens, 
  UserRole, 
  DeviceInfo 
} from '../types/auth';
import { auth, firebaseApp } from '../lib/firebase';
import { api } from '../lib/api';
import { 
  setSecureStorage, 
  getSecureStorage, 
  removeSecureStorage, 
  StorageKeys 
} from '../lib/storage';

// Constants for token and session management
const TOKEN_ROTATION_INTERVAL = 3600000; // 1 hour
const MAX_DEVICES = 5;
const SESSION_TIMEOUT = 28800000; // 8 hours

// Validation schemas using Zod
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  deviceInfo: z.object({
    deviceId: z.string(),
    deviceName: z.string(),
    platform: z.string(),
    browserInfo: z.string()
  })
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.SECRETARY]),
  deviceInfo: z.object({
    deviceId: z.string(),
    deviceName: z.string(),
    platform: z.string(),
    browserInfo: z.string()
  })
});

/**
 * Error handler decorator for authentication operations
 */
function withErrorHandling(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      console.error(`Auth error in ${propertyKey}:`, error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  };

  return descriptor;
}

/**
 * Retry decorator for authentication operations
 */
function withRetry(attempts: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError;
      for (let i = 0; i < attempts; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }
      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Authentication service class with enhanced security features
 */
class AuthService {
  private tokenRefreshInterval?: NodeJS.Timeout;

  constructor() {
    // Initialize token refresh mechanism
    this.setupTokenRefresh();
    
    // Setup auth state listener
    onAuthStateChanged(auth, this.handleAuthStateChange.bind(this));
  }

  /**
   * Handles Firebase authentication state changes
   */
  private async handleAuthStateChange(user: any) {
    if (user) {
      const token = await user.getIdToken();
      await this.setupSession(token);
    } else {
      await this.clearSession();
    }
  }

  /**
   * Sets up user session with secure token storage
   */
  private async setupSession(firebaseToken: string) {
    try {
      const response = await api.post<AuthTokens>('/auth/session', {
        firebase_token: firebaseToken
      });

      await setSecureStorage(StorageKeys.AUTH_TOKEN, response.data.access_token);
      this.setupTokenRefresh();
    } catch (error) {
      console.error('Session setup failed:', error);
      await this.clearSession();
    }
  }

  /**
   * Cleans up user session and tokens
   */
  private async clearSession() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }
    await removeSecureStorage(StorageKeys.AUTH_TOKEN);
  }

  /**
   * Sets up automatic token refresh
   */
  private setupTokenRefresh() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    this.tokenRefreshInterval = setInterval(
      async () => {
        try {
          await this.refreshToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
          await this.clearSession();
        }
      },
      TOKEN_ROTATION_INTERVAL
    );
  }

  /**
   * Authenticates user with enhanced security measures
   */
  @withErrorHandling
  @withRetry(3)
  public async login(credentials: LoginCredentials, deviceInfo: DeviceInfo): Promise<AuthUser> {
    // Validate input
    const validatedData = loginSchema.parse({ ...credentials, deviceInfo });

    // Firebase authentication
    const userCredential = await signInWithEmailAndPassword(
      auth,
      validatedData.email,
      validatedData.password
    );

    // Get Firebase token
    const firebaseToken = await userCredential.user.getIdToken();

    // Exchange Firebase token for JWT tokens
    const response = await api.post<AuthTokens>('/auth/login', {
      firebase_token: firebaseToken,
      device_info: validatedData.deviceInfo
    });

    // Store tokens securely
    await setSecureStorage(StorageKeys.AUTH_TOKEN, response.data.access_token);
    await setSecureStorage(StorageKeys.DEVICE_ID, deviceInfo.deviceId);

    // Setup token refresh
    this.setupTokenRefresh();

    // Return user data
    return {
      id: userCredential.user.uid,
      email: userCredential.user.email!,
      full_name: userCredential.user.displayName || '',
      role: response.data.role,
      is_active: true,
      created_at: new Date(userCredential.user.metadata.creationTime!),
      updated_at: new Date(userCredential.user.metadata.lastSignInTime!),
      last_login: new Date()
    };
  }

  /**
   * Registers new user with LGPD compliance
   */
  @withErrorHandling
  public async register(data: RegisterData, deviceInfo: DeviceInfo): Promise<AuthUser> {
    // Validate input
    const validatedData = registerSchema.parse({ ...data, deviceInfo });

    // Create Firebase user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      validatedData.email,
      validatedData.password
    );

    // Get Firebase token
    const firebaseToken = await userCredential.user.getIdToken();

    // Create user profile
    const response = await api.post<AuthTokens>('/auth/register', {
      firebase_token: firebaseToken,
      full_name: validatedData.full_name,
      role: validatedData.role,
      device_info: validatedData.deviceInfo
    });

    // Store tokens securely
    await setSecureStorage(StorageKeys.AUTH_TOKEN, response.data.access_token);
    await setSecureStorage(StorageKeys.DEVICE_ID, deviceInfo.deviceId);

    // Setup token refresh
    this.setupTokenRefresh();

    // Return new user data
    return {
      id: userCredential.user.uid,
      email: userCredential.user.email!,
      full_name: validatedData.full_name,
      role: validatedData.role,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login: new Date()
    };
  }

  /**
   * Signs out user and cleans up sessions
   */
  @withErrorHandling
  public async logout(deviceInfo: DeviceInfo): Promise<void> {
    try {
      // Revoke device token
      const deviceId = await getSecureStorage<string>(StorageKeys.DEVICE_ID);
      if (deviceId) {
        await api.post('/auth/revoke', { device_id: deviceId });
      }

      // Sign out from Firebase
      await signOut(auth);

      // Clear session
      await this.clearSession();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Refreshes authentication tokens
   */
  @withErrorHandling
  @withRetry(2)
  public async refreshToken(deviceInfo?: DeviceInfo): Promise<AuthTokens> {
    const currentToken = await getSecureStorage<string>(StorageKeys.AUTH_TOKEN);
    if (!currentToken) {
      throw new Error('No token available for refresh');
    }

    const response = await api.post<AuthTokens>('/auth/refresh', {
      device_info: deviceInfo
    });

    await setSecureStorage(StorageKeys.AUTH_TOKEN, response.data.access_token);
    return response.data;
  }
}

// Export singleton instance
export const authService = new AuthService();