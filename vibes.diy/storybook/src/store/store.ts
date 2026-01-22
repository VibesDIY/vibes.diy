import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import designTokensReducer from './designTokensSlice';

const persistConfig = {
  key: 'vibes-design-tokens',
  storage,
  version: 1,
};

const persistedReducer = persistReducer(persistConfig, designTokensReducer);

const createAppStore = () => {
  const store = configureStore({
    reducer: {
      designTokens: persistedReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }),
  });

  const persistor = persistStore(store);

  return { store, persistor };
};

if (typeof window !== 'undefined') {
  if (!(window as any).__VIBES_REDUX_STORE__) {
    (window as any).__VIBES_REDUX_STORE__ = createAppStore();
  }
}

const storeInstance = typeof window !== 'undefined'
  ? (window as any).__VIBES_REDUX_STORE__
  : createAppStore();

export const store = storeInstance.store;
export const persistor = storeInstance.persistor;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
