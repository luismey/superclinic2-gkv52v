// @ts-check
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // v1.9.5
import { z } from 'zod'; // v3.22.0

import {
  WhatsAppConfig,
  AIAssistantConfig,
  ProfileSettings,
  TeamMember,
  BillingInfo,
  whatsAppConfigSchema,
  aiAssistantConfigSchema,
  lgpdConsentConfigSchema,
} from '../types/settings';

import { settingsService } from '../services/settings';
import { StorageKeys } from '../lib/storage';
import { UserRole } from '../types/auth';

// Cache duration constants
const CACHE_DURATION = {
  WHATSAPP: 15 * 60 * 1000, // 15 minutes
  AI_ASSISTANT: 30 * 60 * 1000, // 30 minutes
  PROFILE: 60 * 60 * 1000, // 1 hour
};

// State interface
interface SettingsState {
  whatsappConfig: WhatsAppConfig | null;
  aiAssistantConfig: AIAssistantConfig | null;
  profileSettings: ProfileSettings | null;
  teamMembers: TeamMember[];
  billingInfo: BillingInfo | null;
  loadingStates: {
    [key: string]: 'idle' | 'loading' | 'succeeded' | 'failed';
  };
  errors: {
    [key: string]: string | null;
  };
  cache: {
    [key: string]: {
      timestamp: number;
      data: any;
    };
  };
}

// Initial state
const initialState: SettingsState = {
  whatsappConfig: null,
  aiAssistantConfig: null,
  profileSettings: null,
  teamMembers: [],
  billingInfo: null,
  loadingStates: {},
  errors: {},
  cache: {},
};

// Async thunks
export const fetchWhatsAppConfig = createAsyncThunk(
  'settings/fetchWhatsAppConfig',
  async (_, { getState, rejectWithValue }) => {
    try {
      const config = await settingsService.getWhatsAppConfig();
      const validated = whatsAppConfigSchema.parse(config);
      return validated;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { settings: SettingsState };
      const cached = state.settings.cache['whatsapp'];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION.WHATSAPP) {
        return false;
      }
      return true;
    },
  }
);

export const updateWhatsAppConfig = createAsyncThunk(
  'settings/updateWhatsAppConfig',
  async (config: Partial<WhatsAppConfig>, { rejectWithValue }) => {
    try {
      const updated = await settingsService.updateWhatsAppConfig(config);
      const validated = whatsAppConfigSchema.parse(updated);
      return validated;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAIAssistantConfig = createAsyncThunk(
  'settings/fetchAIAssistantConfig',
  async (_, { getState, rejectWithValue }) => {
    try {
      const config = await settingsService.getAIAssistantConfig();
      const validated = aiAssistantConfigSchema.parse(config);
      return validated;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { settings: SettingsState };
      const cached = state.settings.cache['aiAssistant'];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION.AI_ASSISTANT) {
        return false;
      }
      return true;
    },
  }
);

export const updateAIAssistantConfig = createAsyncThunk(
  'settings/updateAIAssistantConfig',
  async (config: Partial<AIAssistantConfig>, { rejectWithValue }) => {
    try {
      const updated = await settingsService.updateAIAssistantConfig(config);
      const validated = aiAssistantConfigSchema.parse(updated);
      return validated;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchProfileSettings = createAsyncThunk(
  'settings/fetchProfileSettings',
  async (_, { getState, rejectWithValue }) => {
    try {
      const settings = await settingsService.getProfileSettings();
      // Validate LGPD consent settings
      const validatedLgpd = lgpdConsentConfigSchema.parse(settings.lgpd_consent_settings);
      return { ...settings, lgpd_consent_settings: validatedLgpd };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateTeamMember = createAsyncThunk(
  'settings/updateTeamMember',
  async ({ memberId, settings }: { memberId: string; settings: Partial<TeamMember> }, { rejectWithValue }) => {
    try {
      // Validate role permissions
      if (settings.role && !Object.values(UserRole).includes(settings.role as UserRole)) {
        throw new Error('Invalid role assignment');
      }
      return await settingsService.updateTeamMemberSettings(memberId, settings);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Settings slice
const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearSettingsCache: (state) => {
      state.cache = {};
    },
    clearSettingsError: (state, action) => {
      state.errors[action.payload] = null;
    },
  },
  extraReducers: (builder) => {
    // WhatsApp config
    builder
      .addCase(fetchWhatsAppConfig.pending, (state) => {
        state.loadingStates.whatsapp = 'loading';
        state.errors.whatsapp = null;
      })
      .addCase(fetchWhatsAppConfig.fulfilled, (state, action) => {
        state.whatsappConfig = action.payload;
        state.loadingStates.whatsapp = 'succeeded';
        state.cache.whatsapp = {
          timestamp: Date.now(),
          data: action.payload,
        };
      })
      .addCase(fetchWhatsAppConfig.rejected, (state, action) => {
        state.loadingStates.whatsapp = 'failed';
        state.errors.whatsapp = action.payload as string;
      })

    // AI Assistant config
      .addCase(fetchAIAssistantConfig.pending, (state) => {
        state.loadingStates.aiAssistant = 'loading';
        state.errors.aiAssistant = null;
      })
      .addCase(fetchAIAssistantConfig.fulfilled, (state, action) => {
        state.aiAssistantConfig = action.payload;
        state.loadingStates.aiAssistant = 'succeeded';
        state.cache.aiAssistant = {
          timestamp: Date.now(),
          data: action.payload,
        };
      })
      .addCase(fetchAIAssistantConfig.rejected, (state, action) => {
        state.loadingStates.aiAssistant = 'failed';
        state.errors.aiAssistant = action.payload as string;
      })

    // Profile settings
      .addCase(fetchProfileSettings.pending, (state) => {
        state.loadingStates.profile = 'loading';
        state.errors.profile = null;
      })
      .addCase(fetchProfileSettings.fulfilled, (state, action) => {
        state.profileSettings = action.payload;
        state.loadingStates.profile = 'succeeded';
      })
      .addCase(fetchProfileSettings.rejected, (state, action) => {
        state.loadingStates.profile = 'failed';
        state.errors.profile = action.payload as string;
      })

    // Team member updates
      .addCase(updateTeamMember.fulfilled, (state, action) => {
        const index = state.teamMembers.findIndex(member => member.id === action.payload.id);
        if (index !== -1) {
          state.teamMembers[index] = action.payload;
        }
      });
  },
});

// Selectors
export const selectWhatsAppConfig = (state: { settings: SettingsState }) => state.settings.whatsappConfig;
export const selectAIAssistantConfig = (state: { settings: SettingsState }) => state.settings.aiAssistantConfig;
export const selectProfileSettings = (state: { settings: SettingsState }) => state.settings.profileSettings;
export const selectTeamMembers = (state: { settings: SettingsState }) => state.settings.teamMembers;
export const selectLoadingState = (state: { settings: SettingsState }, key: string) => 
  state.settings.loadingStates[key] || 'idle';
export const selectError = (state: { settings: SettingsState }, key: string) => 
  state.settings.errors[key] || null;

// Memoized selectors
export const selectActiveTeamMembers = createSelector(
  [selectTeamMembers],
  (members) => members.filter(member => member.is_active)
);

export const { clearSettingsCache, clearSettingsError } = settingsSlice.actions;

export default settingsSlice.reducer;