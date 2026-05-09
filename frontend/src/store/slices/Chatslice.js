import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    thinking: false,
    error: null,
    sessionId: null,
  },
  reducers: {
    setSessionId(state, action) {
      state.sessionId = action.payload;
    },
    // Called when WebSocket receives chat_history on connect
    setChatHistory(state, action) {
      state.messages = action.payload.map((m, i) => ({
        id: i,
        role: m.role,
        content: m.content,
      }));
    },
    addUserMessage(state, action) {
      state.messages.push({
        role: "user",
        content: action.payload,
        id: Date.now(),
      });
      state.thinking = true;
      state.error = null;
    },
    addAiMessage(state, action) {
      state.messages.push({
        role: "ai",
        content: action.payload,
        id: Date.now(),
      });
      state.thinking = false;
    },
    setThinking(state, action) {
      state.thinking = action.payload;
    },
    setChatError(state, action) {
      state.thinking = false;
      state.error = action.payload;
    },
    clearChat(state) {
      state.messages = [];
      state.error = null;
      state.thinking = false;
      state.sessionId = null;
    },
  },
});

export const {
  setSessionId,
  setChatHistory,
  addUserMessage,
  addAiMessage,
  setThinking,
  setChatError,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;

export const selectMessages    = (state) => state.chat?.messages  || [];
export const selectThinking    = (state) => state.chat?.thinking  || false;
export const selectChatError   = (state) => state.chat?.error     || null;
export const selectSessionId   = (state) => state.chat?.sessionId || null;