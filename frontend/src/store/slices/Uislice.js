import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    adminTab: "docs",   // 'docs' | 'analytics' | 'config' | 'logs'
    sidebarOpen: true,
  },
  reducers: {
    setAdminTab(state, action) {
      state.adminTab = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { setAdminTab, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;

export const selectAdminTab = (state) => state.ui.adminTab;
export const selectSidebarOpen = (state) => state.ui.sidebarOpen;