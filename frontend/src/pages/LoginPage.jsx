import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data } = await login(form.email, form.password);
    setLoading(false);
    
    if (data?.user) {
      navigate(data.user.is_verified ? "/#support" : "/verify-otp");
    }
  };

  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Access your Aion ecosystem and secure support."
      quote="Velocity isn't just speed; it's how efficiently you move through your day."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400 ml-1">Identity</label>
          <input 
            type="email" 
            placeholder="Work Email" 
            required
            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-950 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300"
            onChange={(e) => setForm({...form, email: e.target.value})}
          />
        </div>

        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400 ml-1">Credentials</label>
          <input 
            type="password" 
            placeholder="Password" 
            required
            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-950 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300"
            onChange={(e) => setForm({...form, password: e.target.value})}
          />
        </div>

        <button 
          disabled={loading}
          className="w-full bg-slate-950 text-white font-black text-sm uppercase tracking-widest py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Authenticating..." : "Authorize Access"}
        </button>
      </form>

      <div className="mt-10 flex flex-col items-center gap-4">
        <p className="text-sm text-slate-400 font-medium">
          New to the ecosystem? 
          <Link to="/register" className="ml-2 text-slate-900 font-black hover:underline underline-offset-4">
            Join Aion
          </Link>
        </p>
        
        <Link to="/forgot-password" size="sm" className="font-mono text-[10px] uppercase tracking-tighter text-slate-300 hover:text-slate-500 transition-colors">
          Reset Encryption Keys
        </Link>
      </div>
    </AuthLayout>
  );
}