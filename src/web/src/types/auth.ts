// @ts-check
import { User } from 'firebase/auth'; // ^9.0.0
import { BaseModel } from './common';

/**
 * Enumeration of user roles in the system
 * Based on the Role Permissions Matrix from Technical Specifications/7.1.3
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SECRETARY = 'SECRETARY'
}

/**
 * Password validation constants
 * Ensures strong password requirements for security
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

/**
 * Interface extending BaseModel for authenticated user data
 * Implements user profile requirements from Technical Specifications/7.1.1
 */
export interface AuthUser extends BaseModel {
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  firebase_uid?: string;
  last_login?: Date;
  mfa_enabled?: boolean;
}

/**
 * Interface for login credentials
 * Used in authentication requests
 */
export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

/**
 * Interface for user registration data
 * Extends login credentials with additional required fields
 */
export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  clinic_id?: string;
}

/**
 * Interface for authentication state management
 * Used in Redux/Context state management
 */
export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
}

/**
 * Interface for authentication tokens
 * Implements JWT token requirements from Technical Specifications/7.1.1
 */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

/**
 * Interface for password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Interface for password update
 */
export interface PasswordUpdateData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

/**
 * Interface for MFA configuration
 */
export interface MFAConfig {
  enabled: boolean;
  method: 'sms' | 'authenticator';
  phone_number?: string;
}

/**
 * Type guard to check if a user has required permissions
 * @param user - The authenticated user
 * @param requiredRole - The minimum required role
 */
export function hasPermission(user: AuthUser | null, requiredRole: UserRole): boolean {
  if (!user) return false;
  
  const roleHierarchy = {
    [UserRole.ADMIN]: 3,
    [UserRole.MANAGER]: 2,
    [UserRole.SECRETARY]: 1
  };

  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}

/**
 * Type guard to check if a value is a valid UserRole
 * @param value - The value to check
 */
export function isUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

/**
 * Maps Firebase User to AuthUser
 * @param firebaseUser - Firebase User object
 * @param additionalData - Additional user data from database
 */
export function mapFirebaseUser(
  firebaseUser: User,
  additionalData?: Partial<AuthUser>
): Partial<AuthUser> {
  return {
    email: firebaseUser.email || '',
    firebase_uid: firebaseUser.uid,
    is_active: !firebaseUser.disabled,
    last_login: firebaseUser.metadata.lastSignInTime 
      ? new Date(firebaseUser.metadata.lastSignInTime)
      : undefined,
    ...additionalData
  };
}

/**
 * Type for authentication error codes
 */
export type AuthErrorCode =
  | 'auth/invalid-credentials'
  | 'auth/user-disabled'
  | 'auth/user-not-found'
  | 'auth/wrong-password'
  | 'auth/email-already-in-use'
  | 'auth/invalid-email'
  | 'auth/operation-not-allowed'
  | 'auth/weak-password'
  | 'auth/expired-token'
  | 'auth/invalid-token'
  | 'auth/mfa-required';