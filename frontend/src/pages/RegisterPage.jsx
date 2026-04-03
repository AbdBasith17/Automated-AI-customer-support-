import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import AuthLayout from "../components/AuthLayout";

/**
 * RegisterPage
 * Premium registration flow for the Aion Electric ecosystem.
 */
export default function RegisterPage() {
  const navigate = useNavigate();
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
      return;
    }

    // Redirect to OTP with the email in the URL
    navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
  };
return (
    <AuthLayout
      title="Join the Future"
      subtitle="Establish your digital identity in the Aion ecosystem."
      quote="Intelligence isn't just a feature—it's the engine of the Aion Stealth."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Row */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-widest text-slate-400 ml-1">First</label>
            <input
              name="firstName"
              type="text"
              placeholder="Elon"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
              onChange={handleChange}
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-widest text-slate-400 ml-1">Last</label>
            <input
              name="lastName"
              type="text"
              placeholder="Musk"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="font-mono text-[9px] uppercase tracking-widest text-slate-400 ml-1">Identity</label>
          <input
            name="email"
            type="email"
            placeholder="name@company.com"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
            onChange={handleChange}
          />
        </div>

        {/* Passwords - Stacked tightly */}
        <div className="space-y-1">
          <label className="font-mono text-[9px] uppercase tracking-widest text-slate-400 ml-1">Security</label>
          <div className="space-y-2">
            <input
              name="password"
              type="password"
              placeholder="Create Password"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
              onChange={handleChange}
            />
            <input
              name="password2"
              type="password"
              placeholder="Confirm Password"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all text-sm font-medium focus:ring-2 focus:ring-slate-950 focus:bg-white"
              onChange={handleChange}
            />
          </div>
        </div>

        <button
          disabled={loading}
          className="w-full bg-slate-950 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:bg-slate-800 transition-all shadow-xl mt-2 disabled:opacity-50"
        >
          {loading ? "INITIALIZING..." : "GENERATE IDENTITY"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400 font-medium">
        Already part of the ecosystem?{" "}
        <Link to="/login" className="text-slate-950 font-black hover:underline underline-offset-4">Sign In</Link>
      </p>
    </AuthLayout>
  );
}