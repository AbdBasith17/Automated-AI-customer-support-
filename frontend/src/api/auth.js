import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001/api/auth";


const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});


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
      url: "/register/",
      data: { first_name: firstName, last_name: lastName, email, password, password2 },
    }),

  verifyOtp: (email, otpCode) =>
    request({
      method: "POST",
      url: "/verify-otp/",
      data: { email, otp_code: otpCode },
    }),

  resendOtp: (email) =>
    request({
      method: "POST",
      url: "/resend-otp/",
      data: { email },
    }),

  login: (email, password) =>
    request({
      method: "POST",
      url: "/login/",
      data: { email, password },
    }),

  googleLogin: (payload) => 
  request({
    method: "POST",
    url: "/google/",
    data: payload, 
  }),

  logout: () => request({ method: "POST", url: "/logout/" }),

  getMe: () => request({ method: "GET", url: "/me/" }),

  refreshToken: () => request({ method: "POST", url: "/token/refresh/" }),

  // --- MFA ---
  setupMfa: () => request({ method: "GET", url: "/mfa/setup/" }),

  activateMfa: (code) =>
    request({
      method: "POST",
      url: "/mfa/activate/",
      data: { code },
    }),

  verifyMfaLogin: (email, code) =>
    request({
      method: "POST",
      url: "/mfa/verify-login/",
      data: { email, code },
    }),

  // --- PASSWORD RECOVERY ---
  forgotPassword: (email) =>
    request({
      method: "POST",
      url: "/password-reset/",
      data: { email },
    }),

  resetPasswordConfirm: (uid, token, new_password, confirm_password) =>
    request({
      method: "POST",
      url: "/password-reset-confirm/",
      data: { uid, token, new_password, confirm_password },
    }),
};