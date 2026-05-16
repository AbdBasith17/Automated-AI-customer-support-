import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

async function request(config) {
  try {
    const response = await api(config);
    return { data: response.data, error: null };
  } catch (err) {
    return { data: null, error: err.response?.data || { message: "Request failed" } };
  }
}

export const documentApi = {
  // AdminDocumentListView
  list: () => request({ method: "GET", url: "/documents/admin/all-docs/" }),

  // DocumentUploadView — backend accepts ONE file at a time
  upload: (file) => {
    const formData = new FormData();
    formData.append("file", file);          
    return request({
      method: "POST",
      url: "/documents/upload/",
      data: formData,
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // DocumentDeleteView
  delete: (pk) => request({ method: "DELETE", url: `/documents/admin/delete/${pk}/` }),
};