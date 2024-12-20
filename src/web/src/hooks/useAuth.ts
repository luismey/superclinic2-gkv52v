import { useCallback, useEffect, useRef } from 'react'; // ^18.0.0
import FingerprintJS from '@fingerprintjs/fingerprintjs'; // ^3.4.0
import { useAppDispatch, useAppSelector } from '../store';
import {
  loginUser,
  registerUser,
  logoutUser,
  checkAuth,
  selectAuth,
  rotateToken,
  validateDevice,
} from '../store/authSlice';
import {
  AuthUser,
  LoginCredentials,
  RegisterData,
  DeviceInfo,
  LGPDConsent,
  AuthError,
} from '../types/auth';

// Constants for token rotation and device management
const TOKEN_ROTATION_INTERVAL = 3600000; // 1 hour
const SESSION_TIMEOUT = 28800000; // 8 hours
const MAX_DEVICES = 5;

/**
 * Enhanced authentication hook with LGPD compliance and multi-device support
 * @returns Authentication state and operations
 */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const tokenRotationInterval = useRef<NodeJS.Timeout>();
  const sessionTimeout = useRef<NodeJS.Timeout>();
  const fpPromise = useRef(FingerprintJS.load());

  /**
   * Handles secure login with device fingerprinting and LGPD consent
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      // Generate device fingerprint
      const fp = await fpPromise.current;
      const result = await fp.get();
      
      const deviceInfo: DeviceInfo = {
        deviceId: result.visitorId,
        deviceName: navigator.userAgent,
        platform: navigator.platform,
        browserInfo: navigator.userAgent,
        lastActive: new Date(),
        isVerified: false
      };

      // Validate device against whitelist
      const deviceValidation = await dispatch(validateDevice(deviceInfo)).unwrap();
      
      if (!deviceValidation.isAllowed) {
        throw new Error('Dispositivo não autorizado. Entre em contato com o suporte.');
      }

      // Check device limit
      if (deviceValidation.deviceCount >= MAX_DEVICES) {
        throw new Error('Número máximo de dispositivos atingido. Remova um dispositivo existente.');
      }

      // Perform login
      const user = await dispatch(loginUser({ credentials, deviceInfo })).unwrap();

      // Initialize token rotation
      startTokenRotation();
      
      // Initialize session timeout
      startSessionTimeout();

      return user;
    } catch (error) {
      throw new Error(`Falha na autenticação: ${error.message}`);
    }
  }, [dispatch]);

  /**
   * Handles user registration with LGPD consent validation
   */
  const register = useCallback(async (data: RegisterData) => {
    try {
      // Generate device fingerprint
      const fp = await fpPromise.current;
      const result = await fp.get();
      
      const deviceInfo: DeviceInfo = {
        deviceId: result.visitorId,
        deviceName: navigator.userAgent,
        platform: navigator.platform,
        browserInfo: navigator.userAgent,
        lastActive: new Date(),
        isVerified: false
      };

      // Register user with device info
      const user = await dispatch(registerUser({ data, deviceInfo })).unwrap();
      
      // Initialize token rotation and session timeout
      startTokenRotation();
      startSessionTimeout();

      return user;
    } catch (error) {
      throw new Error(`Falha no registro: ${error.message}`);
    }
  }, [dispatch]);

  /**
   * Handles secure logout with device cleanup
   */
  const logout = useCallback(async () => {
    try {
      // Get current device info
      const fp = await fpPromise.current;
      const result = await fp.get();
      
      await dispatch(logoutUser({ deviceId: result.visitorId })).unwrap();
      
      // Clear intervals
      if (tokenRotationInterval.current) {
        clearInterval(tokenRotationInterval.current);
      }
      if (sessionTimeout.current) {
        clearTimeout(sessionTimeout.current);
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Initializes token rotation mechanism
   */
  const startTokenRotation = useCallback(() => {
    if (tokenRotationInterval.current) {
      clearInterval(tokenRotationInterval.current);
    }

    tokenRotationInterval.current = setInterval(async () => {
      try {
        const fp = await fpPromise.current;
        const result = await fp.get();
        await dispatch(rotateToken({ deviceId: result.visitorId })).unwrap();
      } catch (error) {
        console.error('Erro na rotação do token:', error);
        await logout();
      }
    }, TOKEN_ROTATION_INTERVAL);
  }, [dispatch, logout]);

  /**
   * Initializes session timeout
   */
  const startSessionTimeout = useCallback(() => {
    if (sessionTimeout.current) {
      clearTimeout(sessionTimeout.current);
    }

    sessionTimeout.current = setTimeout(async () => {
      await logout();
    }, SESSION_TIMEOUT);
  }, [logout]);

  /**
   * Validates device and session status
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      const fp = await fpPromise.current;
      const result = await fp.get();
      
      await dispatch(checkAuth({ deviceId: result.visitorId })).unwrap();
      
      if (auth.isAuthenticated) {
        startTokenRotation();
        startSessionTimeout();
      }
    } catch (error) {
      console.error('Erro na verificação de autenticação:', error);
      await logout();
    }
  }, [dispatch, auth.isAuthenticated, logout, startTokenRotation, startSessionTimeout]);

  /**
   * Updates LGPD consent status
   */
  const updateConsent = useCallback(async (consent: LGPDConsent) => {
    try {
      // Implementation for updating LGPD consent
      // This would typically involve an API call to update the user's consent status
      console.log('Atualizando consentimento LGPD:', consent);
    } catch (error) {
      console.error('Erro ao atualizar consentimento LGPD:', error);
      throw error;
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    return () => {
      if (tokenRotationInterval.current) {
        clearInterval(tokenRotationInterval.current);
      }
      if (sessionTimeout.current) {
        clearTimeout(sessionTimeout.current);
      }
    };
  }, [checkAuthStatus]);

  return {
    user: auth.user,
    loading: auth.loading,
    error: auth.error,
    isAuthenticated: auth.isAuthenticated,
    deviceInfo: auth.deviceInfo,
    consentStatus: auth.consentStatus,
    login,
    register,
    logout,
    checkAuthStatus,
    updateConsent,
  };
};