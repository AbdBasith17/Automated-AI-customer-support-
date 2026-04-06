import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [serverError, setServerError] = useState(""); // Track backend errors

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setServerError(""); // Clear previous errors

    try {
      const { data, error } = await authApi.forgotPassword(email);

      if (error) {
        // If backend returns 404 or a message saying "User not found"
        const errorMessage = error.message || "Identity not found in AION database.";
        setServerError(errorMessage);
        toast.error("Protocol Error", { description: errorMessage });
        setLoading(false);
        return;
      }

      // Success Path
      setIsSubmitted(true);
      toast.success("Recovery Link Dispatched", {
        description: "Check your secure inbox for instructions."
      });
    } catch (err) {
      setServerError("Network handshake failed. System offline.");
      toast.error("Handshake Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={isSubmitted ? "Link Dispatched" : "Recover Access"}
      subtitle={
        isSubmitted 
          ? "We've sent a one-time recovery link to your identity." 
          : "Initiate the credential reset protocol for your account."
      }
      quote="Data is permanent, but access can be restored."
    >
      <div className="max-w-md mx-auto w-full">
        {!isSubmitted ? (
          <form onSubmit={handleResetRequest} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* ERROR DISPLAY AREA */}
            {serverError && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl animate-in shake">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 text-center">
                  {serverError}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">
                Registered Identity
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                required
                className={`w-full px-5 py-4 bg-slate-50 border ${serverError ? 'border-red-200' : 'border-slate-100'} rounded-xl focus:ring-2 focus:ring-slate-950 focus:bg-white outline-none transition-all font-medium text-slate-900 text-sm`}
                onChange={(e) => {
                    setEmail(e.target.value);
                    if(serverError) setServerError(""); // Clear error while typing
                }}
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-100"
            >
              {loading ? "Verifying..." : "Initiate Recovery"}
            </button>
          </form>
        ) : (
          /* SUCCESS DISPLAY AREA */
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed px-4">
              Access link sent to <span className="font-bold text-slate-950">{email}</span>. 
              Please check your inbox to complete the reset.
            </p>
            <button 
               onClick={() => setIsSubmitted(false)}
               className="text-[10px] font-mono uppercase tracking-widest text-indigo-600 font-bold hover:text-indigo-400 transition-colors"
            >
               Resend Protocol
            </button>
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            to="/login"
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-950 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Access
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}