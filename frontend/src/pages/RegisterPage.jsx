import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    password2: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const { data, error } = await authApi.register(
      form.firstName,
      form.lastName,
      form.email,
      form.password,
      form.password2
    );

    setLoading(false);

    if (error) {
      setErrors(error);
      toast.error("Registration Failed. Please check the fields.");
      return;
    }

    toast.success("Identity Created. Awaiting Verification.");
    navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    const { data, error } = await loginWithGoogle(credentialResponse.credential);
    setLoading(false);

    if (data?.user) {
      toast.success("Google Identity Synced");
      navigate("/chat");
    } else {
      toast.error(error || "Google Registration Failed");
    }
  };

  return (
    <AuthLayout
      title="Join the Future"
      subtitle="Establish your digital identity in the Aion ecosystem."
      quote="Intelligence isn't just a feature—it's the engine of the Aion Stealth."
    >
      
      <div className="max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name Row */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">First</label>
              <input
                name="firstName"
                type="text"
                placeholder="Name"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
                onChange={handleChange}
              />
              {errors.first_name && <p className="text-[9px] text-red-500 font-bold ml-1 uppercase">{errors.first_name[0]}</p>}
            </div>
            <div className="flex-1 space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">Last</label>
              <input
                name="lastName"
                type="text"
                placeholder="Surname"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">Identity</label>
            <input
              name="email"
              type="email"
              placeholder="name@company.com"
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
              onChange={handleChange}
            />
            {errors.email && <p className="text-[9px] text-red-500 font-bold ml-1 uppercase">{errors.email[0]}</p>}
          </div>

          {/* Passwords */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">Security</label>
            <div className="space-y-2">
              <input
                name="password"
                type="password"
                placeholder="Create Password"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
                onChange={handleChange}
              />
              <input
                name="password2"
                type="password"
                placeholder="Confirm Password"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
                onChange={handleChange}
              />
              {errors.non_field_errors && <p className="text-[9px] text-red-500 font-bold ml-1 uppercase">{errors.non_field_errors[0]}</p>}
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-slate-950 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-slate-800 transition-all shadow-xl mt-2 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "INITIALIZING..." : "GENERATE IDENTITY"}
          </button>
        </form>

        {/* Third-Party Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em] font-black">
            <span className="bg-white px-4 text-slate-300">Fast Enrollment</span>
          </div>
        </div>

        <div className="flex justify-center w-full overflow-hidden">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error("Google Enrollment Failed")}
            theme="filled_black"
            shape="pill"
            width="100%"
          />
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-400 font-medium">
          Already part of the ecosystem?{" "}
          <Link to="/login" className="text-indigo-600 font-black hover:underline underline-offset-4 ml-1">Sign In</Link>
        </p>
      </div>
    </AuthLayout>
  );
}