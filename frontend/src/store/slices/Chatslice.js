import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const BASE_URL = import.meta.env.VITE_API_URL?.replace("/auth", "") || "http://localhost:9001/api";

// ─── Async Thunk ─────────────────────────────────────────────────────────────

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ content, history }, { rejectWithValue }) => {
    try {
      const res = await fetch(`${BASE_URL}/chat/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      if (!res.ok) throw new Error("Chat API error");
      const data = await res.json();
      return data.reply ?? data.content ?? "No response received.";
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    thinking: false,
    error: null,
  },
  reducers: {
    addUserMessage(state, action) {
      state.messages.push({ role: "user", content: action.payload, id: Date.now() });
    },
    clearChat(state) {
      state.messages = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.thinking = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.thinking = false;
        state.messages.push({ role: "ai", content: action.payload, id: Date.now() });
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.thinking = false;
        state.error = action.payload;
      });
  },
});

export const { addUserMessage, clearChat } = chatSlice.actions;
export default chatSlice.reducer;

// ─── Selectors ───────────────────────────────────────────────────────────────
export const selectMessages = (state) => state.chat.messages;
export const selectThinking = (state) => state.chat.thinking;