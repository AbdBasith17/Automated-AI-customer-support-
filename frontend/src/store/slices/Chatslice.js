import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    chatList: [],     
    ticketList: [],   
    thinking: false,
    error: null,
    sessionId: null,
    sidebarVersion: 0,
  },
  reducers: {
    setSessionId(state, action) {
      state.sessionId = action.payload;
    },
    setChatList(state, action) {
      state.chatList = action.payload;
    },
    setTicketList(state, action) {
      state.ticketList = action.payload;
    },
    setChatHistory(state, action) {
      state.messages = action.payload.map((m, i) => ({
        id: m.timestamp || i, 
        role: m.role,
        content: m.content,
      }));
      state.thinking = false;
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

   upsertChatInList(state, action) {
    const { session_id, topic } = action.payload;
    const idx = state.chatList.findIndex((c) => c.session_id === session_id);
    if (idx >= 0) {
      
      state.chatList[idx].topic = topic;
    } else {
     
      state.chatList.unshift({ session_id, topic, last_active: Date.now() });
    }
  },

  upsertTicketInList(state, action) {
  const updatedTicket = action.payload;
  const idx = state.ticketList.findIndex((t) => t.ticket_key === updatedTicket.ticket_key);
  if (idx >= 0) {
    state.ticketList[idx] = { ...state.ticketList[idx], ...updatedTicket };
  } else {
    state.ticketList.unshift(updatedTicket);
  }
},

  bumpSidebar(state) {
    state.sidebarVersion += 1;
  },
},
});

export const {
  setSessionId,
  setChatList,
  setTicketList,
  setChatHistory,
  addUserMessage,
  addAiMessage,
  setThinking,
  setChatError,
  clearChat,
  upsertChatInList,
  bumpSidebar,
  upsertTicketInList,
} = chatSlice.actions;

export default chatSlice.reducer;

export const selectMessages    = (state) => state.chat?.messages  ;
export const selectThinking    = (state) => state.chat?.thinking  || false;
export const selectChatError   = (state) => state.chat?.error     || null;
export const selectSessionId   = (state) => state.chat?.sessionId || null;
export const selectChatList    = (state) => state.chat?.chatList   ;
export const selectTicketList  = (state) => state.chat?.ticketList ;
export const selectSidebarVersion = (state) => state.chat?.sidebarVersion ?? 0;