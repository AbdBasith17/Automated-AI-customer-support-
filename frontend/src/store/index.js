import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { 
  persistStore, 
  persistReducer,
  FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER 
} from "redux-persist";
import storage from "redux-persist/lib/storage"; 

import authReducer from "./slices/authslice";
import uiReducer from "./slices/Uislice";
import chatReducer from "./slices/Chatslice";

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  chat: chatReducer, // ✅ 2. Add it to the root reducer
});

const persistConfig = {
  key: "root",
  version: 1,
  storage: storage.default ? storage.default : storage, 
  // Optional: Add "chat" here if you want your messages to persist 
  // when you refresh the page.
  whitelist: ["ui", "auth", "chat"], 
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
