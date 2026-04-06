import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth";
import AuthLayout from "../components/AuthLayout";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setError("Encryption keys do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: apiError } = await authApi.resetPasswordConfirm(
      uid, 
      token, 
      passwords.new, 
      passwords.confirm
    );

    if (apiError) {
      setError(apiError.error || "Link expired or invalid protocol.");
      toast.error("Update Failed");
      setLoading(false);
    } else {
      toast.success("Identity Secured", { description: "Credentials updated successfully." });
      
      setTimeout(() => navigate("/login"), 2000);
    }
  };

  return (
    <AuthLayout
      title="Credential Update"
      subtitle="Define your new access encryption keys."
      quote="Security is a process, not a product."
    >
      <div className="max-w-md mx-auto w-full">
        <form onSubmit={handleReset} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          
          {error && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500 text-center">
                {error}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">New Password</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-950 outline-none transition-all text-sm"
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">Confirm Identity</label>
              <input
                type="password"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-slate-950 outline-none transition-all text-sm"
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-slate-800 transition-all"
          >
            {loading ? "Updating Protocol..." : "Update Credentials"}
          </button>
        </form>

        <div className="mt-8 flex justify-center">
            <Link to="/login" className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
                Cancel Protocol
            </Link>
        </div>
      </div>
    </AuthLayout>
  );
}