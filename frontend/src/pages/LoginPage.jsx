import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth"; // Import the updated authApi
import AuthLayout from "../components/AuthLayout";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";

export default function LoginPage() {
  const { login, loginWithGoogle, setUser } = useAuth();
  const navigate = useNavigate();

  // State Management
  const [form, setForm] = useState({ email: "", password: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [isMfaStep, setIsMfaStep] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Initial Login Step
    const { data, error: loginError } = await login(form.email, form.password);

    if (loginError) {
      setLoading(false);
      setError(loginError.message || "Access Denied: Invalid Credentials.");
      return;
    }

  
    if (data?.mfa_required) {
      setIsMfaStep(true);
      setLoading(false);
      toast.info("Step 2 Required", { description: "Identify via Authenticator." });
      return;
    }

    if (data?.user) {
      toast.success("Authentication Successful");
      navigate("/chat");
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: mfaError } = await authApi.verifyMfaLogin(form.email, mfaCode);
    setLoading(false);

    if (mfaError) {
      setError(mfaError.message || "Invalid Authenticator Code.");
      return;
    }

    if (data?.user) {
      setUser(data.user);
      toast.success("Identity Confirmed");
      navigate("/chat");
    }
  };

 const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    const { data, error: googleError } = await authApi.googleLogin(credentialResponse.credential);
    setLoading(false);

    
    if (data?.mfa_required) {
        setForm({ ...form, email: data.email }); 
        setIsMfaStep(true);
        toast.info("MFA Required", { description: "Verify via Authenticator." });
        return;
    }

    if (data?.user) {
        setUser(data.user);
        toast.success("Google Identity Verified");
        navigate("/chat");
    } else {
        toast.error(googleError?.message || "Google Sync Failed");
    }
};

  return (
    <AuthLayout
      title={isMfaStep ? "Verify Identity" : "Access Core"}
      subtitle={isMfaStep ? "Enter the 6-digit code from your app." : "Identify yourself to the Aion RAG infrastructure."}
      quote="Security is not a product, but a process."
    >
      <div className="max-w-md mx-auto w-full">

        {/*  Standard Login Form */}
        {!isMfaStep ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl animate-in fade-in slide-in-from-top-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 text-center">{error}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">Identity</label>
              <input
                type="email"
                placeholder="Work Email"
                required
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-950 focus:bg-white outline-none transition-all font-medium text-slate-900 text-sm"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">Credentials</label>
              <input
                type="password"
                placeholder="Password"
                required
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-950 focus:bg-white outline-none transition-all font-medium text-slate-900 text-sm"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              {loading ? "Authorizing..." : "Authorize Access"}
            </button>
          </form>
        ) : (
          /*  MFA Verification Form */
          <form onSubmit={handleMfaVerify} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {error && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 text-center">{error}</p>
              </div>
            )}

            <div className="space-y-2 text-center">
              <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-950 font-black">Secure Code</label>
              <input type="text" name="email" style={{ display: 'none' }} autoComplete="username" />
              <input
                type="text"
                maxLength="6"
                placeholder="000 000"
                autoFocus
                
                name="one-time-code"
                autocomplete="one-time-code"
                inputMode="numeric"
                
                className="w-full text-center font-mono text-4xl tracking-[0.4em] py-6 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-950"
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              {loading ? "Verifying..." : "Confirm Identity"}
            </button>

            <button
              type="button"
              onClick={() => setIsMfaStep(false)}
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
                width="100%"
              />
            </div>
          </>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-slate-400 font-medium">
            New to the ecosystem?
            <Link to="/register" className="ml-2 text-indigo-600 font-black hover:underline underline-offset-4">Join Aion</Link>
          </p>
          <Link to="/forgot-password" size="sm" className="font-mono mt-5 text-[13px] uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors">
             Forgot Password
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}