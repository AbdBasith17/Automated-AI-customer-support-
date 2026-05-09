import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

async function request(config) {
  try {
    const response = await api(config);
    return { data: response.data, error: null };
  } catch (err) {
    return { data: null, error: err.response?.data || { message: "Request failed" } };
  }
}

export const analyticsApi = {
  getSummary:      ()            => request({ method: "GET", url: "/ai/analytics/summary" }),
  getTicketVolume: (days = 30)   => request({ method: "GET", url: `/ai/analytics/tickets/volume?days=${days}` }),
  getLatency:      (days = 7)    => request({ method: "GET", url: `/ai/analytics/messages/latency?days=${days}` }),
  getCacheRate:    ()            => request({ method: "GET", url: "/ai/analytics/messages/cache-rate" }),
  getTopTopics:    (limit = 10)  => request({ method: "GET", url: `/ai/analytics/topics/top?limit=${limit}` }),
};