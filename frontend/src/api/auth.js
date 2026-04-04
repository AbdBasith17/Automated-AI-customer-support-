

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9001/api/auth";

async function request(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include", 
      ...options,
    });

    if (response.status === 204) {
      return { data: { success: true }, error: null };
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      return { data: null, error: data };
    }

    return { data, error: null };
  } catch (err) {
    console.error("API Fetch Error:", err);
    return { 
      data: null, 
      error: { message: "Network error. Is the backend running at " + BASE_URL + "?" } 
    };
  }
}

export const authApi = {
  // --- EXISTING AUTH ---
  register: (firstName, lastName, email, password, password2) =>
    request("/register/", {
      method: "POST",
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        password2,
      }),
    }),

  verifyOtp: (email, otpCode) =>
    request("/verify-otp/", {
      method: "POST",
      body: JSON.stringify({ 
        email, 
        otp_code: otpCode 
      }),
    }),

  resendOtp: (email) =>
    request("/resend-otp/", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  login: (email, password) =>
    request("/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  googleLogin: (googleToken) =>
    request("/google/", {
      method: "POST",
      body: JSON.stringify({ token: googleToken }),
    }),

  logout: () =>
    request("/logout/", { method: "POST" }),

  getMe: () =>
    request("/me/", { method: "GET" }),

  refreshToken: () =>
    request("/token/refresh/", { method: "POST" }),

  // --- NEW MFA COMPONENTS ---

  
  setupMfa: () => 
    request("/mfa/setup/", { method: "GET" }),

  
  activateMfa: (code) =>
    request("/mfa/activate/", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  
  verifyMfaLogin: (email, code) =>
    request("/mfa/verify-login/", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
};