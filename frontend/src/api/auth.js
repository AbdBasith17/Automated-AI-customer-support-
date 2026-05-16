import axios from "axios";

// 1. Create Axios Instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, 
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// 2. Response Interceptor (Handles Token Refresh & Global Errors)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await axios.post(
          `${import.meta.env.VITE_API_URL.replace(/\/auth\/?$/, '')}/auth/token/refresh/`,
          {},
          { withCredentials: true }
        );
        return api(originalRequest);
      } catch (refreshError) {
       
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// 3. Helper Request Wrapper
async function request(config) {
  try {
    const response = await api(config);
    return { data: response.data, error: null };
  } catch (err) {
    console.error("API Error:", err.response || err.message);
    return {
      data: null,
      error: err.response?.data || { message: "Network handshake failed." },
    };
  }
}

// 4. Combined Auth & Chat API
export const authApi = {
  // --- AUTHENTICATION ---
  register: (firstName, lastName, email, password, password2) =>
    request({
      method: "POST",
      url: "/auth/register/",
      data: { first_name: firstName, last_name: lastName, email, password, password2 },
    }),

  verifyOtp: (email, otpCode) =>
    request({
      method: "POST",
      url: "/auth/verify-otp/",
      data: { email, otp_code: otpCode },
    }),

  resendOtp: (email) =>
    request({
      method: "POST",
      url: "/auth/resend-otp/",
      data: { email },
    }),

  login: (email, password) =>
    request({
      method: "POST",
      url: "/auth/login/",
      data: { email, password },
    }),

  googleLogin: (payload) => 
    request({
      method: "POST",
      url: "/auth/google/",
      data: payload, 
    }),

  logout: () => request({ method: "POST", url: "/auth/logout/" }),

  getMe: () => request({ method: "GET", url: "/auth/me/" }),

  refreshToken: () => request({ method: "POST", url: "/auth/token/refresh/" }),

  // --- MFA ---
  setupMfa: () => request({ method: "GET", url: "/auth/mfa/setup/" }),

  activateMfa: (code) =>
    request({
      method: "POST",
      url: "/auth/mfa/activate/",
      data: { code },
    }),

  verifyMfaLogin: (mfaToken, code) =>
    request({
      method: "POST",
      url: "/auth/mfa/verify-login/",
      data: { mfa_token: mfaToken, code },
    }),

  // --- PASSWORD RECOVERY ---
  forgotPassword: (email) =>
    request({
      method: "POST",
      url: "/auth/password-reset/",
      data: { email },
    }),

  resetPasswordConfirm: (uid, token, new_password, confirm_password) =>
    request({
      method: "POST",
      url: "/auth/password-reset-confirm/",
      data: { uid, token, new_password, confirm_password },
    }),

  // --- FCM / NOTIFICATIONS ---
    registerFcmToken: (userEmail, fcmToken) =>
  request({
    method: "POST",
    url: "/ai/register-token",
    data: { user_email: userEmail, fcm_token: fcmToken },  
  }),

  // --- CHAT & TICKETS (Added here to fix Sidebar error) ---
  getChatSessions: () => 
    request({ 
      method: "GET", 
      url: "/chat/sessions/" 
    }),

  getTickets: () => 
    request({ 
      method: "GET", 
      url: "/chat/tickets/" 
    }),

  renameSession: (sessionId, topic) =>
  request({
    method: "PATCH",
    url: `/chat/sessions/${sessionId}/rename/`,
    data: { topic },
  }),

deleteSession: (sessionId) =>
  request({
    method: "DELETE",
    url: `/chat/sessions/${sessionId}/delete/`,
  }),
};

export default api;