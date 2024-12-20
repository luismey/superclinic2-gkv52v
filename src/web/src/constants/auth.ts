// @ts-check
import { AuthErrorCodes } from 'firebase/auth'; // ^9.0.0
import { UserRole, Permission } from '../types/auth';

/**
 * Local storage keys for authentication tokens
 * Based on Technical Specifications/7.1.1 Authentication Methods
 */
export const AUTH_TOKEN_KEY = 'porfin_auth_token';
export const REFRESH_TOKEN_KEY = 'porfin_refresh_token';

/**
 * Token configuration constants
 * Based on Technical Specifications/7.1.1 Authentication Methods
 */
export const TOKEN_EXPIRY_TIME = 3600; // 1 hour in seconds
export const TOKEN_REFRESH_THRESHOLD = 300; // 5 minutes before expiry

/**
 * Firebase authentication error codes mapping
 * Based on Technical Specifications/7.1.1 Authentication Methods
 */
export const AUTH_ERROR_CODES = {
  INVALID_EMAIL: AuthErrorCodes.INVALID_EMAIL,
  USER_DISABLED: AuthErrorCodes.USER_DISABLED,
  USER_NOT_FOUND: AuthErrorCodes.USER_NOT_FOUND,
  WRONG_PASSWORD: AuthErrorCodes.WRONG_PASSWORD,
  EMAIL_EXISTS: AuthErrorCodes.EMAIL_ALREADY_IN_USE,
  WEAK_PASSWORD: AuthErrorCodes.WEAK_PASSWORD,
  EXPIRED_TOKEN: 'auth/id-token-expired',
  INVALID_TOKEN: 'auth/invalid-id-token'
} as const;

/**
 * Role-based permission mappings
 * Based on Technical Specifications/7.1.2 Authorization Model
 * and Technical Specifications/7.1.3 Role Permissions Matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.USERS,
    Permission.WHATSAPP,
    Permission.CAMPAIGNS,
    Permission.ANALYTICS,
    Permission.SETTINGS
  ],
  [UserRole.MANAGER]: [
    Permission.WHATSAPP,
    Permission.CAMPAIGNS,
    Permission.ANALYTICS
  ],
  [UserRole.SECRETARY]: [
    Permission.WHATSAPP
  ]
} as const;

/**
 * OAuth2 configuration constants
 * Based on Technical Specifications/2.4.2 Security Architecture
 */
export const OAUTH_CONFIG = {
  GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  AUTHORIZATION_ENDPOINT: '/api/v1/auth/authorize',
  TOKEN_ENDPOINT: '/api/v1/auth/token',
  REVOKE_ENDPOINT: '/api/v1/auth/revoke',
  SCOPE: 'openid profile email',
  RESPONSE_TYPE: 'code',
  GRANT_TYPE: {
    AUTHORIZATION_CODE: 'authorization_code',
    REFRESH_TOKEN: 'refresh_token'
  }
} as const;

/**
 * MFA (Multi-Factor Authentication) configuration
 * Based on Technical Specifications/7.1.1 Authentication Methods
 */
export const MFA_CONFIG = {
  ENABLED: true,
  METHODS: {
    SMS: 'sms',
    AUTHENTICATOR: 'authenticator'
  },
  SETUP_ENDPOINT: '/api/v1/auth/mfa/setup',
  VERIFY_ENDPOINT: '/api/v1/auth/mfa/verify'
} as const;

/**
 * Session configuration constants
 * Based on Technical Specifications/2.4.2 Security Architecture
 */
export const SESSION_CONFIG = {
  COOKIE_NAME: 'porfin_session',
  MAX_AGE: 7 * 24 * 60 * 60, // 7 days in seconds
  SECURE: process.env.NODE_ENV === 'production',
  SAME_SITE: 'lax' as const,
  HTTP_ONLY: true,
  PATH: '/'
} as const;

/**
 * Password policy constants
 * Based on Technical Specifications/7.1.1 Authentication Methods
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL_CHAR: true,
  MAX_AGE_DAYS: 90,
  PREVENT_REUSE: 5 // Number of previous passwords to check
} as const;