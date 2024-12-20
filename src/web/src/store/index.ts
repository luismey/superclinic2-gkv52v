// @ts-check
import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit'; // v1.9.5
import thunk from 'redux-thunk'; // v2.4.2

// Import feature reducers
import authReducer from './authSlice';
import campaignReducer from './campaignSlice';
import chatReducer from './chatSlice';
import settingsReducer from './settingsSlice';

// Custom middleware for real-time state synchronization
const websocketMiddleware: Middleware = store => next => action => {
  // Handle real-time actions
  if (action.type?.startsWith('chat/') || action.type?.startsWith('campaign/')) {
    // Emit relevant actions to WebSocket for real-time sync
    if (window.socket) {
      window.socket.emit('state_change', {
        type: action.type,
        payload: action.payload,
        timestamp: Date.now()
      });
    }
  }
  return next(action);
};

// Performance monitoring middleware
const monitoringMiddleware: Middleware = store => next => action => {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now();
    const result = next(action);
    const end = performance.now();
    
    console.log(`Action: ${action.type} took ${end - start}ms`);
    return result;
  }
  return next(action);
};

// Root reducer combining all feature slices
const rootReducer = combineReducers({
  auth: authReducer,
  campaign: campaignReducer,
  chat: chatReducer,
  settings: settingsReducer
});

// Configure store with middleware and development tools
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      // Ignore non-serializable values in specific paths
      ignoredActions: ['socket/connect', 'socket/disconnect'],
      ignoredPaths: ['chat.websocketConnection']
    },
    thunk: {
      extraArgument: {
        api: window.api
      }
    }
  }).concat(
    thunk,
    websocketMiddleware,
    monitoringMiddleware
  ),
  devTools: process.env.NODE_ENV === 'development',
  preloadedState: undefined,
  enhancers: (defaultEnhancers) => defaultEnhancers
});

// Export store instance and types
export default store;

// Infer RootState and AppDispatch types from store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Type-safe hooks for use throughout the application
export type AppStore = typeof store;

// Export store subscription for real-time updates
export const subscribeToStore = (
  selector: (state: RootState) => unknown,
  callback: (selectedData: unknown) => void
) => {
  let currentState: unknown;

  const handleChange = () => {
    const nextState = selector(store.getState());
    if (nextState !== currentState) {
      currentState = nextState;
      callback(currentState);
    }
  };

  const unsubscribe = store.subscribe(handleChange);
  handleChange(); // Initial call

  return unsubscribe;
};

// Export store enhancer for performance monitoring
export const withMonitoring = (store: AppStore) => {
  if (process.env.NODE_ENV === 'development') {
    store.subscribe(() => {
      const state = store.getState();
      console.group('State Update');
      console.log('Current State:', state);
      console.log('Memory Usage:', performance.memory?.usedJSHeapSize);
      console.groupEnd();
    });
  }
  return store;
};

// Initialize store monitoring in development
if (process.env.NODE_ENV === 'development') {
  withMonitoring(store);
}