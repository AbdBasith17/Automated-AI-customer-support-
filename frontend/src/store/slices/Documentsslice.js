import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/auth"; // Using the centralized Axios instance

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const fetchDocuments = createAsyncThunk(
  "documents/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      // The 'api' instance already has the baseURL and withCredentials
      const res = await api.get("/documents/");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: "Failed to load documents." });
    }
  }
);

export const uploadDocuments = createAsyncThunk(
  "documents/upload",
  async (files, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      
      const res = await api.post("/documents/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: "Upload failed." });
    }
  }
);

export const deleteDocument = createAsyncThunk(
  "documents/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/documents/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: "Delete failed." });
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const documentsSlice = createSlice({
  name: "documents",
  initialState: {
    list: [],          
    stagedFiles: [],   
    uploading: false,
    fetchStatus: "idle", 
    error: null,
  },
  reducers: {
    stageFiles(state, action) {
      state.stagedFiles = [...state.stagedFiles, ...action.payload];
    },
    removeStagedFile(state, action) {
      state.stagedFiles = state.stagedFiles.filter((_, i) => i !== action.payload);
    },
    clearStagedFiles(state) {
      state.stagedFiles = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchDocuments
      .addCase(fetchDocuments.pending, (state) => {
        state.fetchStatus = "loading";
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.list = action.payload;
        state.fetchStatus = "succeeded";
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.fetchStatus = "failed";
        state.error = action.payload?.message;
      })
      // uploadDocuments
      .addCase(uploadDocuments.pending, (state) => {
        state.uploading = true;
        state.error = null;
      })
      .addCase(uploadDocuments.fulfilled, (state, action) => {
        state.uploading = false;
        if (Array.isArray(action.payload)) {
          state.list = [...state.list, ...action.payload];
        }
        state.stagedFiles = [];
      })
      .addCase(uploadDocuments.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload?.message;
      })
      // deleteDocument
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.list = state.list.filter((doc) => doc.id !== action.payload);
      });
  },
});

export const { stageFiles, removeStagedFile, clearStagedFiles } = documentsSlice.actions;
export default documentsSlice.reducer;

export const selectDocuments = (state) => state.documents.list;
export const selectStagedFiles = (state) => state.documents.stagedFiles;
export const selectUploading = (state) => state.documents.uploading;
export const selectDocsLoading = (state) => state.documents.fetchStatus === "loading";