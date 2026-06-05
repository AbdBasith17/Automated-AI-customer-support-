import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { handleApiError } from "../utils/handleApiError";

// ─── tiny helpers ────────────────────────────────────────────────────────────

function FieldError({ error }) {
  if (!error) return null;
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <p className="mt-1 text-[9px] text-red-500 font-bold ml-1 uppercase tracking-wider">
      {msg}
    </p>
  );
}

function InputField({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  required = false,
  autoFocus = false,
  rightLabel = null,
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center px-1">
        <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">
          {label}
        </label>
        {rightLabel}
      </div>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        className={`w-full px-5 py-3.5 bg-slate-50 border rounded-xl outline-none transition-all text-sm font-medium
          focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900
          ${error ? "border-red-300 bg-red-50" : "border-slate-100"}`}
      />
      <FieldError error={error} />
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login, setUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "", mfaToken: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // clear error for this field when user types
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  // ── Step 1: email + password ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const { data, error: loginError } = await login(form.email, form.password);

    if (loginError) {
      setLoading(false);
      handleApiError(loginError, setErrors, (msg) => toast.error(msg));
      return;
    }

    // MFA required — move to step 2
    if (data?.mfa_required) {
      setForm((prev) => ({ ...prev, mfaToken: data.mfa_token }));
      setIsMfaStep(true);
      setLoading(false);
      toast.info("Step 2: Enter your authenticator code.");
      return;
    }

    if (data?.user) {
      toast.success("Authentication Successful");
      navigate(data.user.role === "admin" ? "/admin" : "/chat", {
        replace: true,
        state: { forceNew: true },
      });
    }

    setLoading(false);
  };

  // ── Step 2: MFA code ────────────────────────────────────────────────────────
  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      setErrors({ mfa: ["Please enter a 6-digit code."] });
      return;
    }

    setLoading(true);
    setErrors({});

    const { data, error: mfaError } = await authApi.verifyMfaLogin(
      form.mfaToken,
      mfaCode
    );

    if (mfaError) {
      setLoading(false);
      // MFA has no field-level errors — always toast
      const msg =
        typeof mfaError === "object"
          ? mfaError?.non_field_errors?.[0] ||
            mfaError?.error ||
            "Invalid authenticator code."
          : mfaError;
      toast.error(msg);
      return;
    }

    if (data?.user) {
      setUser(data.user);
      toast.success("Identity Confirmed");
      navigate(data.user.role === "admin" ? "/admin" : "/chat", {
        replace: true,
      });
    }

    setLoading(false);
  };

  // ── Google OAuth ────────────────────────────────────────────────────────────
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    const { data, error: googleError } = await authApi.googleLogin({
      token: credentialResponse.credential,
    });

    if (googleError) {
      setLoading(false);
      toast.error(
        typeof googleError === "object"
          ? googleError?.non_field_errors?.[0] || "Google sign-in failed."
          : googleError
      );
      return;
    }

    if (data?.mfa_required) {
      setForm((prev) => ({ ...prev, mfaToken: data.mfa_token }));
      setIsMfaStep(true);
      setLoading(false);
      toast.info("MFA Required — verify via authenticator.");
      return;
    }

    if (data?.user) {
      setUser(data.user);
      toast.success("Google Identity Verified");
      navigate(data.user.role === "admin" ? "/admin" : "/chat", {
        replace: true,
      });
    }

    setLoading(false);
  };

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <AuthLayout
      title={isMfaStep ? "Verify Identity" : "Welcome Back"}
      subtitle={
        isMfaStep
          ? "Enter the 6-digit code from your authenticator app."
          : "Sign in to access support, training, and Aion resources."
      }
      quote="Built for the road. Backed by intelligence."
    >
      <div className="max-w-md mx-auto w-full">

        {/* ── Step 1: Login Form ─────────────────────────────────────────── */}
        {!isMfaStep ? (
          <form onSubmit={handleSubmit} className="space-y-4">

            <InputField
              label="Identity"
              name="email"
              type="email"
              placeholder="Work Email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              required
            />

            <InputField
              label="Credentials"
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              required
              rightLabel={
                <Link
                  to="/forgot-password"
                  className="font-mono text-[9px] uppercase tracking-widest text-indigo-600 hover:text-indigo-400 font-bold transition-colors"
                >
                  Forgot?
                </Link>
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "Authorizing..." : "Authorize Access"}
            </button>
          </form>

        ) : (

          /* ── Step 2: MFA Form ─────────────────────────────────────────── */
          <form
            onSubmit={handleMfaVerify}
            className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500"
          >
            <div className="space-y-2 text-center">
              <label
                htmlFor="mfa-input"
                className="block font-mono text-[10px] uppercase tracking-[0.3em] text-slate-950 font-black"
              >
                Secure Code
              </label>

              {/* hidden username field for password managers */}
              <input
                type="text"
                name="email"
                style={{ display: "none" }}
                autoComplete="username"
                readOnly
              />

              <input
                id="mfa-input"
                type="text"
                name="mfa"
                placeholder="000 000"
                autoFocus
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                value={mfaCode}
                className={`w-full text-center font-mono text-4xl tracking-[0.4em] py-6 bg-slate-50 rounded-2xl border-2 outline-none transition-all text-slate-950
                  ${errors.mfa ? "border-red-300 bg-red-50" : "border-slate-100 focus:border-indigo-500 focus:bg-white"}`}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setMfaCode(val);
                  if (errors.mfa) setErrors((prev) => ({ ...prev, mfa: null }));
                }}
              />
              <FieldError error={errors.mfa} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm Identity"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMfaStep(false);
                setMfaCode("");
                setErrors({});
              }}
              className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              ← Back to Login
            </button>
          </form>
        )}

        {/* ── Google OAuth ───────────────────────────────────────────────── */}
        {!isMfaStep && (
          <>
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-black">
                <span className="bg-white px-4 text-slate-300">OR</span>
              </div>
            </div>

            <div className="flex justify-center w-full overflow-hidden">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error("Google Handshake Failed")}
                shape="pill"
                width="250"
              />
            </div>
          </>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-slate-400 font-medium">
            New to the ecosystem?
            <Link
              to="/register"
              className="ml-2 text-indigo-600 font-black hover:underline underline-offset-4"
            >
              Join Aion
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}