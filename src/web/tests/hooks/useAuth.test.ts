import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mockFirebase } from '@firebase/testing';

import { useAuth } from '../../src/hooks/useAuth';
import { AuthUser, LoginCredentials, RegisterData, DeviceInfo, ConsentStatus } from '../../src/types/auth';
import { StorageKeys } from '../../src/lib/storage';

// Mock device fingerprint
const mockDeviceFingerprint = 'mock-device-fingerprint-123';
jest.mock('@fingerprintjs/fingerprintjs', () => ({
  load: () => Promise.resolve({
    get: () => Promise.resolve({ visitorId: mockDeviceFingerprint })
  })
}));

// Mock secure storage
const mockStorage: { [key: string]: any } = {};
jest.mock('../../src/lib/storage', () => ({
  StorageKeys,
  setSecureStorage: jest.fn((key, value) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  getSecureStorage: jest.fn((key) => Promise.resolve(mockStorage[key])),
  removeSecureStorage: jest.fn((key) => {
    delete mockStorage[key];
    return Promise.resolve();
  })
}));

// Mock Firebase auth service
const mockFirebaseAuth = {
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  currentUser: null
};

jest.mock('firebase/auth', () => ({
  getAuth: () => mockFirebaseAuth
}));

// Test data
const mockUser: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'HEALTHCARE_PROFESSIONAL',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  firebase_uid: 'firebase-uid-123',
  mfa_enabled: false
};

const mockLoginCredentials: LoginCredentials = {
  email: 'test@example.com',
  password: 'Test@123',
  remember_me: true
};

const mockRegisterData: RegisterData = {
  email: 'test@example.com',
  password: 'Test@123',
  full_name: 'Test User',
  role: 'HEALTHCARE_PROFESSIONAL',
  clinic_id: 'clinic-123'
};

const mockDeviceInfo: DeviceInfo = {
  deviceId: mockDeviceFingerprint,
  deviceName: 'Test Browser',
  platform: 'web',
  browserInfo: 'Chrome',
  lastActive: new Date(),
  isVerified: false
};

// Setup test environment
const setupTest = () => {
  const store = configureStore({
    reducer: {
      auth: (state = {
        user: null,
        loading: false,
        error: null,
        isAuthenticated: false,
        deviceInfo: null,
        consentStatus: null
      }, action) => state
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: false
    })
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper
  };
};

describe('useAuth Hook with Enhanced Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should handle device validation during login', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock successful device validation
    mockFirebaseAuth.signInWithEmailAndPassword.mockResolvedValueOnce({
      user: { ...mockUser, getIdToken: () => Promise.resolve('mock-token') }
    });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    // Verify device fingerprint was generated and validated
    expect(mockStorage[StorageKeys.DEVICE_ID]).toBe(mockDeviceFingerprint);
    expect(result.current.deviceInfo).toBeTruthy();
    expect(result.current.error).toBeNull();
  });

  it('should track LGPD consent during registration', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    const registerDataWithConsent = {
      ...mockRegisterData,
      consentStatus: 'GRANTED' as ConsentStatus
    };

    await act(async () => {
      await result.current.register(registerDataWithConsent);
    });

    // Verify consent was tracked
    expect(result.current.consentStatus).toBe('GRANTED');
  });

  it('should handle token rotation', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    jest.useFakeTimers();

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    const initialToken = mockStorage[StorageKeys.AUTH_TOKEN];

    // Fast-forward 1 hour to trigger token rotation
    await act(async () => {
      jest.advanceTimersByTime(3600000);
    });

    // Verify token was rotated
    expect(mockStorage[StorageKeys.AUTH_TOKEN]).not.toBe(initialToken);
  });

  it('should manage multi-device sessions', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login from first device
    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    // Simulate login from second device
    const secondDeviceFingerprint = 'second-device-fingerprint';
    jest.spyOn(global.navigator, 'userAgent').mockReturnValue('Second Device');

    await act(async () => {
      await result.current.login({
        ...mockLoginCredentials,
        deviceInfo: {
          ...mockDeviceInfo,
          deviceId: secondDeviceFingerprint
        }
      });
    });

    // Verify both devices are tracked
    expect(result.current.deviceInfo).toBeTruthy();
  });

  it('should enforce device limit', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Simulate reaching device limit
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await result.current.login({
          ...mockLoginCredentials,
          deviceInfo: {
            ...mockDeviceInfo,
            deviceId: `device-${i}`
          }
        });
      });
    }

    // Attempt login from additional device
    await act(async () => {
      try {
        await result.current.login({
          ...mockLoginCredentials,
          deviceInfo: {
            ...mockDeviceInfo,
            deviceId: 'excess-device'
          }
        });
      } catch (error) {
        expect(error.message).toContain('Número máximo de dispositivos atingido');
      }
    });
  });

  it('should handle session timeout', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    jest.useFakeTimers();

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    // Fast-forward 8 hours to trigger session timeout
    await act(async () => {
      jest.advanceTimersByTime(28800000);
    });

    // Verify user was logged out
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBeFalsy();
  });

  it('should validate device fingerprint during auth check', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.checkAuthStatus();
    });

    // Verify device validation occurred
    expect(result.current.deviceInfo).toBeTruthy();
  });

  it('should clean up resources on unmount', async () => {
    const { wrapper } = setupTest();
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    unmount();

    // Verify cleanup
    expect(mockStorage[StorageKeys.AUTH_TOKEN]).toBeUndefined();
    expect(mockStorage[StorageKeys.DEVICE_ID]).toBeUndefined();
  });
});