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

export const resourceApi = {
 
  listAdmin: () => request({ 
    method: "GET", 
    url: "/documents/admin/resources/" 
  }),

  upload: (formData) => request({
    method: "POST",
    url: "/documents/admin/resources/",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
  }),

  update: (id, data) => request({ 
    method: "PUT", 
    url: `/documents/admin/resources/${id}/`, 
    data 
  }),

  delete: (id) => request({ 
    method: "DELETE", 
    url: `/documents/admin/resources/${id}/` 
  }),

  
  listUser: () => request({ 
    method: "GET", 
    url: "/documents/resources/" 
  }),

  
  getUrl: (id, action = "view") => request({ 
    method: "GET", 
    url: `/documents/resources/${id}/url/`,
    params: { action } 
  }),
  
};
