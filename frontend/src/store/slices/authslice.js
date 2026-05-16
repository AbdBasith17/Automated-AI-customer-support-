import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authApi } from "../../api/auth";

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const checkSession = createAsyncThunk(
  "auth/checkSession",
  async (_, { rejectWithValue }) => {
    const { data, error } = await authApi.getMe();
    if (error) return rejectWithValue(error);
    return data?.user || data;
  }
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    const { data, error } = await authApi.login(email, password);
    if (error) return rejectWithValue(error);
    return data; 
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  await authApi.logout();
});

export const loginWithGoogleThunk = createAsyncThunk(
  "auth/loginWithGoogle",
  async (credential, { rejectWithValue }) => {
    
    const { data, error } = await authApi.googleLogin({ id_token: credential }); 
    if (error) return rejectWithValue(error);
    return data;
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    loading: true, 
    error: null,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // checkSession
    builder
      .addCase(checkSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        state.user = action.payload ?? null;
        state.loading = false;
      })
      .addCase(checkSession.rejected, (state) => {
        state.user = null;
        state.loading = false;
      });

    // login — only set user if not an MFA handoff
    builder.addCase(loginUser.fulfilled, (state, action) => {
      if (action.payload?.user) state.user = action.payload.user;
    });

    // logout
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
    });

    // Google login — only set user if not an MFA handoff
    builder.addCase(loginWithGoogleThunk.fulfilled, (state, action) => {
      if (action.payload?.user) state.user = action.payload.user;
    });
  },
});

export const { setUser, clearAuthError } = authSlice.actions;
export default authSlice.reducer;

// ─── Selectors ───────────────────────────────────────────────────────────────
export const selectUser = (state) => state.auth.user;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectIsLoggedIn = (state) => !!state.auth.user;
export const selectIsVerified = (state) => !!state.auth.user?.is_verified;