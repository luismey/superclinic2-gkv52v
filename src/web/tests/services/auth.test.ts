// @ts-check
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { authService } from '../../src/services/auth';
import { auth, firebaseApp } from '../../src/lib/firebase';
import { 
  setSecureStorage, 
  getSecureStorage, 
  removeItem 
} from '../../src/lib/storage';
import { 
  AuthUser, 
  LoginCredentials, 
  RegisterData, 
  UserRole, 
  MFAConfig 
} from '../../src/types/auth';

// Mock Firebase auth methods
jest.mock('firebase/auth');
jest.mock('../../src/lib/firebase');
jest.mock('../../src/lib/storage');

// Test data constants
const mockLoginCredentials: LoginCredentials = {
  email: 'test@example.com',
  password: 'Test123!',
  deviceInfo: {
    deviceId: 'test-device-1',
    platform: 'web',
    userAgent: 'jest-test'
  }
};

const mockRegisterData: RegisterData = {
  email: 'test@example.com',
  password: 'Test123!',
  full_name: 'Test User',
  role: UserRole.SECRETARY,
  lgpdConsent: true,
  mfaEnabled: false
};

const mockAuthUser: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: UserRole.SECRETARY,
  is_active: true,
  mfaEnabled: false,
  lgpdConsent: true,
  devices: ['test-device-1']
};

describe('authService', () => {
  let mockSignInWithEmailAndPassword: MockInstance;
  let mockCreateUserWithEmailAndPassword: MockInstance;
  let mockSignOut: MockInstance;
  let mockSetSecureStorage: MockInstance;
  let mockGetSecureStorage: MockInstance;

  beforeEach(() => {
    // Reset all mocks before each test
    mockSignInWithEmailAndPassword = signInWithEmailAndPassword as jest.MockedFunction<typeof signInWithEmailAndPassword>;
    mockCreateUserWithEmailAndPassword = createUserWithEmailAndPassword as jest.MockedFunction<typeof createUserWithEmailAndPassword>;
    mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
    mockSetSecureStorage = setSecureStorage as jest.MockedFunction<typeof setSecureStorage>;
    mockGetSecureStorage = getSecureStorage as jest.MockedFunction<typeof getSecureStorage>;

    // Clear all mock implementations
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('login', () => {
    test('should successfully login with valid credentials', async () => {
      // Arrange
      const mockFirebaseResponse = {
        user: {
          uid: mockAuthUser.id,
          email: mockAuthUser.email,
          getIdToken: jest.fn().mockResolvedValue('mock-token')
        }
      };
      mockSignInWithEmailAndPassword.mockResolvedValue(mockFirebaseResponse);
      mockSetSecureStorage.mockResolvedValue(undefined);

      // Act
      const result = await authService.login(mockLoginCredentials);

      // Assert
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        mockLoginCredentials.email,
        mockLoginCredentials.password
      );
      expect(mockSetSecureStorage).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: mockAuthUser.id,
        email: mockAuthUser.email
      });
    });

    test('should handle MFA verification when enabled', async () => {
      // Arrange
      const mfaUser = { ...mockAuthUser, mfaEnabled: true };
      const mockMFAError = new Error('MFA_REQUIRED');
      mockSignInWithEmailAndPassword.mockRejectedValue(mockMFAError);

      // Act & Assert
      await expect(authService.login(mockLoginCredentials))
        .rejects
        .toThrow('MFA_REQUIRED');
    });

    test('should handle invalid credentials', async () => {
      // Arrange
      const mockAuthError = new Error('auth/invalid-credentials');
      mockSignInWithEmailAndPassword.mockRejectedValue(mockAuthError);

      // Act & Assert
      await expect(authService.login(mockLoginCredentials))
        .rejects
        .toThrow('auth/invalid-credentials');
    });

    test('should enforce rate limiting', async () => {
      // Arrange
      const attempts = Array(5).fill(mockLoginCredentials);
      mockSignInWithEmailAndPassword.mockRejectedValue(new Error('auth/too-many-requests'));

      // Act & Assert
      for (const attempt of attempts) {
        await expect(authService.login(attempt))
          .rejects
          .toThrow('auth/too-many-requests');
      }
    });
  });

  describe('register', () => {
    test('should successfully register new user with LGPD consent', async () => {
      // Arrange
      const mockFirebaseResponse = {
        user: {
          uid: mockAuthUser.id,
          email: mockAuthUser.email,
          getIdToken: jest.fn().mockResolvedValue('mock-token')
        }
      };
      mockCreateUserWithEmailAndPassword.mockResolvedValue(mockFirebaseResponse);

      // Act
      const result = await authService.register(mockRegisterData);

      // Assert
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        mockRegisterData.email,
        mockRegisterData.password
      );
      expect(result).toMatchObject({
        id: mockAuthUser.id,
        email: mockAuthUser.email,
        lgpdConsent: true
      });
    });

    test('should reject registration without LGPD consent', async () => {
      // Arrange
      const invalidData = { ...mockRegisterData, lgpdConsent: false };

      // Act & Assert
      await expect(authService.register(invalidData))
        .rejects
        .toThrow('LGPD consent is required');
    });
  });

  describe('logout', () => {
    test('should successfully logout and clear session', async () => {
      // Arrange
      mockSignOut.mockResolvedValue(undefined);
      mockGetSecureStorage.mockResolvedValue('mock-token');

      // Act
      await authService.logout();

      // Assert
      expect(mockSignOut).toHaveBeenCalledWith(auth);
      expect(removeItem).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    test('should successfully refresh authentication token', async () => {
      // Arrange
      mockGetSecureStorage.mockResolvedValue('old-token');
      const mockNewToken = 'new-token';
      mockSetSecureStorage.mockResolvedValue(undefined);

      // Act
      const result = await authService.refreshToken();

      // Assert
      expect(mockGetSecureStorage).toHaveBeenCalled();
      expect(mockSetSecureStorage).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getCurrentUser', () => {
    test('should return current authenticated user', async () => {
      // Arrange
      mockGetSecureStorage.mockResolvedValue('mock-token');

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toMatchObject(mockAuthUser);
    });
  });

  describe('updateUserRole', () => {
    test('should successfully update user role with proper authorization', async () => {
      // Arrange
      const newRole = UserRole.MANAGER;
      mockGetSecureStorage.mockResolvedValue('mock-token');

      // Act
      const result = await authService.updateUserRole(mockAuthUser.id, newRole);

      // Assert
      expect(result.role).toBe(newRole);
    });
  });

  describe('verifyMFA', () => {
    test('should successfully verify MFA code', async () => {
      // Arrange
      const mockMFACode = '123456';
      mockGetSecureStorage.mockResolvedValue('mock-token');

      // Act
      const result = await authService.verifyMFA(mockMFACode);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('resetPassword', () => {
    test('should successfully initiate password reset', async () => {
      // Arrange
      const email = mockAuthUser.email;

      // Act
      const result = await authService.resetPassword(email);

      // Assert
      expect(result).toBe(true);
    });
  });
});