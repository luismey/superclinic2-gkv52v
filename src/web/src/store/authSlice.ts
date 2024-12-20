// @ts-check
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { 
  AuthUser, 
  AuthState, 
  LoginCredentials, 
  RegisterData, 
  UserRole,
  AuthErrorCode 
} from '../types/auth';
import { authService } from '../services/auth';
import { StorageKeys, setSecureStorage, removeSecureStorage } from '../lib/storage';

// Security and session constants
const TOKEN_ROTATION_INTERVAL = 3600000; // 1 hour
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900000; // 15 minutes

// Interface for device information tracking
interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  browserInfo: string;
  lastActive: Date;
  isVerified: boolean;
}

// Interface for security audit logging
interface SecurityAudit {
  lastLogin: Date | null;
  lastTokenRotation: Date | null;
  failedAttempts: number;
  lockoutUntil: Date | null;
  deviceSessions: DeviceInfo[];
  securityEvents: Array<{
    type: string;
    timestamp: Date;
    details: Record<string, unknown>;
  }>;
}

// Enhanced initial state with security features
const initialState: AuthState & {
  deviceInfo: DeviceInfo[];
  securityAudit: SecurityAudit;
} = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  initialized: false,
  deviceInfo: [],
  securityAudit: {
    lastLogin: null,
    lastTokenRotation: null,
    failedAttempts: 0,
    lockoutUntil: null,
    deviceSessions: [],
    securityEvents: []
  }
};

// Enhanced login thunk with security measures
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ credentials, deviceInfo }: { 
    credentials: LoginCredentials; 
    deviceInfo: DeviceInfo 
  }, { rejectWithValue }) => {
    try {
      // Check for account lockout
      const now = new Date();
      const state = initialState;
      if (state.securityAudit.lockoutUntil && now < state.securityAudit.lockoutUntil) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      // Attempt login
      const user = await authService.login(credentials, deviceInfo);

      // Update device session
      const sessionInfo: DeviceInfo = {
        ...deviceInfo,
        lastActive: new Date(),
        isVerified: true
      };

      // Setup token rotation
      const tokenRotationTimer = setInterval(async () => {
        await authService.rotateToken(deviceInfo);
      }, TOKEN_ROTATION_INTERVAL);

      // Store device ID securely
      await setSecureStorage(StorageKeys.DEVICE_ID, deviceInfo.deviceId);

      return { user, deviceInfo: sessionInfo };
    } catch (error) {
      return rejectWithValue({
        code: (error as any).code || 'AUTH_ERROR',
        message: error.message
      });
    }
  }
);

// Registration thunk with LGPD compliance
export const registerThunk = createAsyncThunk(
  'auth/register',
  async ({ data, deviceInfo }: {
    data: RegisterData;
    deviceInfo: DeviceInfo;
  }, { rejectWithValue }) => {
    try {
      const user = await authService.register(data, deviceInfo);
      
      // Log security event
      const securityEvent = {
        type: 'ACCOUNT_CREATED',
        timestamp: new Date(),
        details: {
          deviceInfo,
          role: data.role
        }
      };

      return { user, securityEvent };
    } catch (error) {
      return rejectWithValue({
        code: (error as any).code || 'REGISTRATION_ERROR',
        message: error.message
      });
    }
  }
);

// Session validation thunk
export const validateSessionThunk = createAsyncThunk(
  'auth/validateSession',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const deviceId = await authService.validateSession();
      
      if (!deviceId) {
        throw new Error('Invalid session');
      }

      return { isValid: true };
    } catch (error) {
      return rejectWithValue({
        code: 'SESSION_INVALID',
        message: error.message
      });
    }
  }
);

// Enhanced auth slice with security features
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<{ code: AuthErrorCode; message: string } | null>) => {
      state.error = action.payload;
    },
    addSecurityEvent: (state, action: PayloadAction<{
      type: string;
      details: Record<string, unknown>;
    }>) => {
      state.securityAudit.securityEvents.push({
        ...action.payload,
        timestamp: new Date()
      });
    },
    updateDeviceSession: (state, action: PayloadAction<DeviceInfo>) => {
      const index = state.deviceInfo.findIndex(d => d.deviceId === action.payload.deviceId);
      if (index >= 0) {
        state.deviceInfo[index] = action.payload;
      } else {
        state.deviceInfo.push(action.payload);
      }
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.deviceInfo = [];
      state.error = null;
      removeSecureStorage(StorageKeys.AUTH_TOKEN);
      removeSecureStorage(StorageKeys.DEVICE_ID);
    }
  },
  extraReducers: (builder) => {
    builder
      // Login handlers
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.securityAudit.lastLogin = new Date();
        state.securityAudit.failedAttempts = 0;
        state.securityAudit.lockoutUntil = null;
        state.deviceInfo.push(action.payload.deviceInfo);
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as { code: AuthErrorCode; message: string };
        state.securityAudit.failedAttempts += 1;
        
        // Implement account lockout
        if (state.securityAudit.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          state.securityAudit.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION);
        }
      })
      // Register handlers
      .addCase(registerThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.securityAudit.securityEvents.push(action.payload.securityEvent);
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as { code: AuthErrorCode; message: string };
      })
      // Session validation handlers
      .addCase(validateSessionThunk.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.deviceInfo = [];
      });
  }
});

// Export actions and selectors
export const { 
  setUser, 
  setLoading, 
  setError, 
  addSecurityEvent, 
  updateDeviceSession, 
  clearAuth 
} = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectSecurityAudit = (state: { auth: AuthState & { securityAudit: SecurityAudit } }) => 
  state.auth.securityAudit;

export default authSlice.reducer;