import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";

export default function LoginPage() {
  const { login, setUser } = useAuth();
  const navigate = useNavigate();

  // State Management
  const [form, setForm] = useState({ email: "", password: "", mfaToken: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Match the unified handle change behavior from RegisterPage
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
    // Also clear general non-field errors when user types again
    if (errors.non_field_errors) setErrors({ ...errors, non_field_errors: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const { data, error: loginError } = await login(form.email, form.password);

    if (loginError) {
      setLoading(false);
      // Map directly to your backend error payload structure
      if (typeof loginError === "object" && !loginError.message) {
        setErrors(loginError);
      } else {
        setErrors({ non_field_errors: [loginError.message || "Authentication Failed"] });
      }
      toast.error("Sign-in Failed. Check credentials.");
      return;
    }

    if (data?.mfa_required) {
      setForm(prev => ({ ...prev, mfaToken: data.mfa_token }));
      setIsMfaStep(true);
      setLoading(false);
      return;
    }

    if (data?.user) {
      toast.success("Authentication Successful");
      const isAdmin = data.user.role === 'admin';
      if (isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/chat", { replace: true, state: { forceNew: true } });
      }
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const { data, error: mfaError } = await authApi.verifyMfaLogin(form.mfaToken, mfaCode);

    if (mfaError) {
      setLoading(false);
      if (typeof mfaError === "object" && !mfaError.message) {
        setErrors(mfaError);
      } else {
        setErrors({ mfa: [mfaError.message || "Invalid Authenticator Code."] });
      }
      return;
    }

    if (data?.user) {
      setUser(data.user);
      toast.success("Identity Confirmed");

      const isAdmin = data.user.role === 'admin';
      setTimeout(() => {
        navigate(isAdmin ? "/admin" : "/chat", { replace: true });
        setLoading(false);
      }, 50);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    const { data, error: googleError } = await authApi.googleLogin({
      token: credentialResponse.credential
    });

    if (googleError) {
      setLoading(false);
      toast.error(googleError?.message || "Google Sync Failed");
      return;
    }

    if (data?.mfa_required) {
      setForm(prev => ({ ...prev, mfaToken: data.mfa_token }));
      setIsMfaStep(true);
      setLoading(false);
      toast.info("MFA Required", { description: "Verify via Authenticator." });
      return;
    }

    if (data?.user) {
      setUser(data.user);
      toast.success("Google Identity Verified");

      const isAdmin = data.user.role === 'admin';
      setTimeout(() => {
        navigate(isAdmin ? "/admin" : "/chat", { replace: true });
        setLoading(false);
      }, 50);
    }
  };

  return (
    <AuthLayout
      title={isMfaStep ? "Verify Identity" : "Access Core"}
      subtitle={isMfaStep ? "Enter the 6-digit code from your app." : "Identify yourself to the Aion RAG infrastructure."}
      quote="Security is not a product, but a process."
    >
      <div className="max-w-md mx-auto w-full">

        {/* Step 1: Standard Login Form */}
        {!isMfaStep ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Identity Field */}
            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">Identity</label>
              <input
                name="email"
                type="email"
                placeholder="Work Email"
                required
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900"
                onChange={handleChange}
              />
              {errors.email && (
                <p className="text-[9px] text-red-500 font-bold ml-1 uppercase">{errors.email[0]}</p>
              )}
            </div>

            {/* Credentials Field */}
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">Credentials</label>
                <Link
                  to="/forgot-password"
                  className="font-mono text-[9px] uppercase tracking-widest text-indigo-600 hover:text-indigo-400 font-bold transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900"
                onChange={handleChange}
              />
              {errors.password && (
                <p className="text-[9px] text-red-500 font-bold ml-1 uppercase">{errors.password[0]}</p>
              )}
              {errors.non_field_errors && (
                <p className="text-[9px] text-red-500 font-bold ml-1 uppercase">{errors.non_field_errors[0]}</p>
              )}
            </div>

            <button
              disabled={loading}
              className="w-full bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "Authorizing..." : "Authorize Access"}
            </button>
          </form>
        ) : (
          /* Step 2: MFA Verification Form */
          <form onSubmit={handleMfaVerify} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            
            <div className="space-y-2 text-center">
              <label
                htmlFor="mfa-input"
                className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-950 font-black"
              >
                Secure Code
              </label>

              <input type="text" name="email" style={{ display: 'none' }} autoComplete="username" />

              <input
                id="mfa-input"
                type="text"
                name="mfa"
                placeholder="000 000"
                autoFocus
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                className="w-full text-center font-mono text-4xl tracking-[0.4em] py-6 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-950"
                onChange={(e) => {
                  setMfaCode(e.target.value.replace(/\D/g, ""));
                  if (errors.mfa) setErrors({ ...errors, mfa: null });
                }}
              />
              {errors.mfa && (
                <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider mt-2">{errors.mfa[0]}</p>
              )}
            </div>

            <button
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm Identity"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMfaStep(false);
                setErrors({});
              }}
              className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600"
            >
              Back to Login
            </button>
          </form>
        )}

        {!isMfaStep && (
          <>
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
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

        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-slate-400 font-medium">
            New to the ecosystem?
            <Link to="/register" className="ml-2 text-indigo-600 font-black hover:underline underline-offset-4">Join Aion</Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}