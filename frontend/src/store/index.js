import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import documentsReducer from "./slices/documentsSlice";
import chatReducer from "./slices/chatSlice";
import uiReducer from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentsReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
});