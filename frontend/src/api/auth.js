import axios from "axios";

const api = axios.create({
  
  baseURL: import.meta.env.VITE_API_URL.replace(/\/auth\/?$/, ''), 
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});


api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

   
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        
        await api.post("/auth/token/refresh/", {});
        
        
        return api(originalRequest);
      } catch (refreshError) {
       
        console.error("Refresh failed. Redirecting to login...");
        
        
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;


api.interceptors.response.use(
  (response) => response, //
  async (error) => {
    const originalRequest = error.config;

    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
       
        await authApi.refreshToken(); 

        
        return api(originalRequest);
      } catch (refreshError) {
        
        window.location.href = "/login"; 
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

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

    registerFcmToken: (sessionId, fcmToken) =>
    request({
      method: "POST",
      url: "/ai/register-token", 
      data: { session_id: sessionId, fcm_token: fcmToken },
    }),
};