import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

/**
 * VerifyOTPPage
 * The final security layer for the Aion Electric ecosystem.
 */
export default function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  // Extract email from URL: /verify-otp?email=user@example.com
  const queryParams = new URLSearchParams(location.search);
  const email = queryParams.get("email") || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus();
  }, []);

  function handleOtpChange(index, value) {
    if (value.length > 1) value = value.charAt(value.length - 1);
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((digit, i) => { if (i < 6) newOtp[i] = digit; });
    setOtp(newOtp);
    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Authorization requires the full 6-digit sequence.");
      return;
    }

    setLoading(true);
    const { data, error } = await authApi.verifyOtp(email, code);
    setLoading(false);

    if (error) {
      setError(error.non_field_errors?.[0] || error.otp_code?.[0] || "Sequence rejected. Invalid or expired.");
      return;
    }

    setUser(data.user);
    navigate("/#support"); // Direct handshake with the support assistant
  }

  async function handleResend() {
    setResent(false);
    setError("");
    const { error } = await authApi.resendOtp(email);
    if (!error) {
      setResent(true);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setTimeout(() => setResent(false), 5000);
    } else {
      setError("Network error: Failed to transmit new code.");
    }
  }

  return (
    <AuthLayout
      title="Verify Identity"
      subtitle={`Encryption code transmitted to ${email || 'your secure inbox'}.`}
      quote="Data integrity is the foundation of the Aion ecosystem. Authenticate to unlock core systems."
      hideSocial={true}
    >
      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400 ml-1 block text-center lg:text-left">
            Security Sequence
          </label>
          <div className="flex gap-2 sm:gap-3 justify-between" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-12 h-16 sm:w-14 sm:h-20 text-center text-3xl font-display font-black border-2 rounded-2xl transition-all outline-none focus:ring-2 focus:ring-slate-950 ${
                  error 
                    ? "border-red-500 bg-red-50 text-red-600 ring-1 ring-red-500" 
                    : "border-slate-100 bg-slate-50 focus:bg-white text-slate-950"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <p className="text-red-500 text-xs font-black uppercase tracking-widest text-center animate-in shake duration-300">
              {error}
            </p>
          )}
          {resent && (
            <p className="text-indigo-600 text-xs font-black uppercase tracking-widest text-center animate-in fade-in">
              New sequence transmitted.
            </p>
          )}

          <button
            disabled={loading}
            className="w-full bg-slate-950 text-white font-black text-sm uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "AUTHENTICATING..." : "CONFIRM & UNLOCK"}
          </button>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={handleResend}
              className="font-mono text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-950 transition-colors"
            >
              Request New Sequence
            </button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}