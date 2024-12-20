/**
 * @fileoverview Route constants for the Porfin platform
 * @version 1.0.0
 * 
 * Defines all application routes following Next.js 13+ App Router conventions.
 * Used for consistent navigation and route management throughout the platform.
 */

/**
 * Authentication related routes
 * Handles user access flows including login, registration and password management
 */
export const AUTH_ROUTES = {
  /** @route /login - User authentication page */
  LOGIN: '/login',
  
  /** @route /register - New user registration page */
  REGISTER: '/register',
  
  /** @route /forgot-password - Password recovery request page */
  FORGOT_PASSWORD: '/forgot-password',
  
  /** @route /reset-password/[token] - Password reset page with verification token */
  RESET_PASSWORD: '/reset-password/[token]',
} as const;

/**
 * Main dashboard and feature routes
 * Core platform functionality including chats, campaigns, analytics and appointments
 */
export const DASHBOARD_ROUTES = {
  /** @route / - Main dashboard home page */
  HOME: '/',
  
  /** @route /chats - WhatsApp chat management */
  CHATS: '/chats',
  
  /** @route /chats/[id] - Individual chat conversation view */
  CHAT_DETAIL: '/chats/[id]',
  
  /** @route /campaigns - Marketing campaign management */
  CAMPAIGNS: '/campaigns',
  
  /** @route /campaigns/new - Create new campaign */
  CAMPAIGN_NEW: '/campaigns/new',
  
  /** @route /campaigns/[id]/edit - Edit existing campaign */
  CAMPAIGN_EDIT: '/campaigns/[id]/edit',
  
  /** @route /campaigns/[id] - Campaign details and metrics */
  CAMPAIGN_DETAIL: '/campaigns/[id]',
  
  /** @route /analytics - Business analytics and reporting */
  ANALYTICS: '/analytics',
  
  /** @route /appointments - Appointment scheduling and management */
  APPOINTMENTS: '/appointments',
  
  /** @route /appointments/[id] - Individual appointment details */
  APPOINTMENT_DETAIL: '/appointments/[id]',
} as const;

/**
 * Settings and configuration routes
 * Platform management including profile, integrations and team settings
 */
export const SETTINGS_ROUTES = {
  /** @route /settings - Main settings page */
  ROOT: '/settings',
  
  /** @route /settings/profile - User profile management */
  PROFILE: '/settings/profile',
  
  /** @route /settings/ai-assistant - AI assistant configuration */
  AI_ASSISTANT: '/settings/ai-assistant',
  
  /** @route /settings/whatsapp - WhatsApp integration settings */
  WHATSAPP: '/settings/whatsapp',
  
  /** @route /settings/team - Team member management */
  TEAM: '/settings/team',
  
  /** @route /settings/billing - Subscription and billing management */
  BILLING: '/settings/billing',
} as const;

// Type definitions for route parameters
export type ChatId = string;
export type CampaignId = string;
export type AppointmentId = string;
export type ResetToken = string;

/**
 * Helper function to generate dynamic route with parameters
 * @param route Base route with parameter placeholders
 * @param params Route parameters to inject
 * @returns Compiled route with actual parameter values
 */
export const generateRoute = <T extends Record<string, string>>(
  route: string,
  params: T
): string => {
  let compiledRoute = route;
  Object.entries(params).forEach(([key, value]) => {
    compiledRoute = compiledRoute.replace(`[${key}]`, value);
  });
  return compiledRoute;
};