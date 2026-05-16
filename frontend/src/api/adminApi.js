import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

async function request(config) {
  try {
    const response = await api(config);
    return { data: response.data, error: null };
  } catch (err) {
    return { data: null, error: err.response?.data || { message: "Request failed" } };
  }
}

export const adminApi = {
  // Analytics
  getUserAnalytics: () =>
    request({ method: "GET", url: "/auth/admin/analytics/users/" }),

  // Users list with filters
  getUsers: (params = {}) =>
    request({ method: "GET", url: "/auth/admin/users/", params }),

  // Toggle active / change role
  updateUser: (userId, data) =>
    request({ method: "PATCH", url: `/auth/admin/users/${userId}/`, data }),
};