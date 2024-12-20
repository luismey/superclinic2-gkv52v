// @ts-check
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { format } from 'date-fns-tz'; // v2.0.0

import {
  Campaign,
  CampaignStatus,
  CampaignType,
  TargetAudienceType,
  MessageTemplate,
  CampaignSchedule,
  CampaignMetrics,
  HealthcareValidation,
  ConsentStatus,
} from '../types/campaigns';
import campaignService from '../services/campaigns';

// State interface with healthcare compliance features
interface CampaignState {
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  loading: boolean;
  error: string | null;
  healthcareCompliance: HealthcareValidation | null;
  consentStatus: ConsentStatus | null;
  websocketConnection: WebSocket | null;
}

// Initial state
const initialState: CampaignState = {
  campaigns: [],
  currentCampaign: null,
  loading: false,
  error: null,
  healthcareCompliance: null,
  consentStatus: null,
  websocketConnection: null,
};

// Async thunks for campaign operations with healthcare compliance
export const fetchCampaigns = createAsyncThunk(
  'campaigns/fetchCampaigns',
  async (_, { rejectWithValue }) => {
    try {
      const campaigns = await campaignService.getCampaigns();
      return campaigns;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createCampaign = createAsyncThunk(
  'campaigns/createCampaign',
  async (campaignData: Omit<Campaign, 'id'>, { rejectWithValue }) => {
    try {
      // Validate healthcare compliance before creation
      const compliance = await campaignService.validateHealthcareCompliance(campaignData as Campaign);
      
      if (!compliance.isCompliant) {
        return rejectWithValue({
          message: 'Healthcare compliance validation failed',
          violations: compliance.violations
        });
      }

      const campaign = await campaignService.createCampaign(campaignData);
      return campaign;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCampaign = createAsyncThunk(
  'campaigns/updateCampaign',
  async ({ id, updates }: { id: string; updates: Partial<Campaign> }, { rejectWithValue }) => {
    try {
      const campaign = await campaignService.updateCampaign(id, updates);
      return campaign;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteCampaign = createAsyncThunk(
  'campaigns/deleteCampaign',
  async (id: string, { rejectWithValue }) => {
    try {
      await campaignService.deleteCampaign(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Campaign slice with healthcare compliance features
const campaignSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    setCurrentCampaign: (state, action: PayloadAction<Campaign | null>) => {
      state.currentCampaign = action.payload;
    },
    setHealthcareCompliance: (state, action: PayloadAction<HealthcareValidation>) => {
      state.healthcareCompliance = action.payload;
    },
    setConsentStatus: (state, action: PayloadAction<ConsentStatus>) => {
      state.consentStatus = action.payload;
    },
    updateCampaignMetrics: (state, action: PayloadAction<{ id: string; metrics: Partial<CampaignMetrics> }>) => {
      const campaign = state.campaigns.find(c => c.id === action.payload.id);
      if (campaign) {
        campaign.metrics = { ...campaign.metrics, ...action.payload.metrics };
      }
    },
    initializeWebSocket: (state) => {
      if (state.websocketConnection) {
        state.websocketConnection.close();
      }
      
      const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws');
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'campaign_update') {
          const campaign = state.campaigns.find(c => c.id === data.payload.id);
          if (campaign) {
            Object.assign(campaign, data.payload);
          }
        }
      };

      state.websocketConnection = ws;
    },
    closeWebSocket: (state) => {
      if (state.websocketConnection) {
        state.websocketConnection.close();
        state.websocketConnection = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch campaigns
      .addCase(fetchCampaigns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns = action.payload;
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create campaign
      .addCase(createCampaign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCampaign.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns.push(action.payload);
        state.currentCampaign = action.payload;
      })
      .addCase(createCampaign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update campaign
      .addCase(updateCampaign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCampaign.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.campaigns.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.campaigns[index] = action.payload;
        }
        if (state.currentCampaign?.id === action.payload.id) {
          state.currentCampaign = action.payload;
        }
      })
      .addCase(updateCampaign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete campaign
      .addCase(deleteCampaign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCampaign.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns = state.campaigns.filter(c => c.id !== action.payload);
        if (state.currentCampaign?.id === action.payload) {
          state.currentCampaign = null;
        }
      })
      .addCase(deleteCampaign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const {
  setCurrentCampaign,
  setHealthcareCompliance,
  setConsentStatus,
  updateCampaignMetrics,
  initializeWebSocket,
  closeWebSocket,
} = campaignSlice.actions;

// Selectors
export const selectAllCampaigns = (state: { campaigns: CampaignState }) => state.campaigns.campaigns;
export const selectCurrentCampaign = (state: { campaigns: CampaignState }) => state.campaigns.currentCampaign;
export const selectCampaignLoading = (state: { campaigns: CampaignState }) => state.campaigns.loading;
export const selectCampaignError = (state: { campaigns: CampaignState }) => state.campaigns.error;
export const selectHealthcareCompliance = (state: { campaigns: CampaignState }) => state.campaigns.healthcareCompliance;
export const selectConsentStatus = (state: { campaigns: CampaignState }) => state.campaigns.consentStatus;

// Export reducer
export default campaignSlice.reducer;