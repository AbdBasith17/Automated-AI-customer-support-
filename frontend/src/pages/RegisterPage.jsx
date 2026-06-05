import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { handleApiError } from "../utils/handleApiError";

// ─── helpers ──────────────────────────────────────────────────────────────────

function FieldError({ error }) {
  if (!error) return null;
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <p className="mt-1 text-[9px] text-red-500 font-bold ml-1 uppercase tracking-wider">
      {msg}
    </p>
  );
}

// ── password strength rules ───────────────────────────────────────────────────
const RULES = [
  { id: "length",    label: "8+ characters",            test: (v) => v.length >= 8 },
  { id: "uppercase", label: "Atleast one uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "number",    label: "Atleast one number",           test: (v) => /[0-9]/.test(v) },
];

function PasswordStrength({ password }) {
  if (!password) return null;
  const failed = RULES.filter((r) => !r.test(password));
  if (failed.length === 0) return null;
  const labels = failed.map((r) => r.label).join(", ");
  return (
    <p className="mt-1 text-[9px] text-slate-400 font-mono uppercase tracking-wider ml-1">
      Must contain: {labels}
    </p>
  );
}

// ── client-side validation ────────────────────────────────────────────────────
function validateForm(form) {
  const errs = {};

  if (!form.firstName.trim())
    errs.first_name = ["First name is required."];

  if (!form.lastName.trim())
    errs.last_name = ["Last name is required."];

  if (!form.email.trim())
    errs.email = ["Email is required."];

  const pwdErrors = [];
  if (form.password.length < 8)     pwdErrors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(form.password)) pwdErrors.push("Must contain at least one uppercase letter.");
  if (!/[0-9]/.test(form.password)) pwdErrors.push("Must contain at least one number.");
  if (pwdErrors.length)             errs.password = pwdErrors;

  if (!form.password2)
    errs.password2 = ["Please confirm your password."];
  else if (form.password !== form.password2)
    errs.password2 = ["Passwords do not match."];

  return errs;
}

// ─── main component ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();

  const [form, setForm] = useState({
    firstName: "",
    lastName:  "",
    email:     "",
    password:  "",
    password2: "",
  });

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));

    if (name === "password" && form.password2) {
      setErrors((prev) => ({
        ...prev,
        password2: value !== form.password2 ? ["Passwords do not match."] : null,
      }));
    }

    if (name === "password2") {
      setErrors((prev) => ({
        ...prev,
        password2: value !== form.password ? ["Passwords do not match."] : null,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const clientErrors = validateForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      toast.error("Please fix the errors below.");
      return;
    }

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
      handleApiError(error, setErrors, (msg) => toast.error(msg));
      return;
    }

    toast.success("Identity Created. Check your email for the OTP.");
    navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    const { data, error } = await loginWithGoogle(credentialResponse.credential);
    setLoading(false);

    if (error) {
      toast.error(
        typeof error === "object"
          ? error?.non_field_errors?.[0] || "Google registration failed."
          : error
      );
      return;
    }

    if (data?.user) {
      toast.success("Google Identity Synced");
      navigate(data.user.role === "admin" ? "/admin" : "/chat", { replace: true });
    }
  };

  const allRulesPassed = RULES.every((r) => r.test(form.password));

  return (
    <AuthLayout
      title="Join Aion Core"
      subtitle="Create your account to access AI support and training resources."
      quote="Built for the road. Backed by intelligence."
    >
      <div className="max-w-sm mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* ── Name Row ──────────────────────────────────────────────────── */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">
                First
              </label>
              <input
                name="firstName"
                type="text"
                placeholder="Name"
                required
                value={form.firstName}
                onChange={handleChange}
                autoComplete="given-name"
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all text-sm font-medium
                  focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900
                  ${errors.first_name ? "border-red-300 bg-red-50" : "border-slate-100"}`}
              />
              <FieldError error={errors.first_name} />
            </div>

            <div className="flex-1 space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">
                Last
              </label>
              <input
                name="lastName"
                type="text"
                placeholder="Surname"
                required
                value={form.lastName}
                onChange={handleChange}
                autoComplete="family-name"
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all text-sm font-medium
                  focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900
                  ${errors.last_name ? "border-red-300 bg-red-50" : "border-slate-100"}`}
              />
              <FieldError error={errors.last_name} />
            </div>
          </div>

          {/* ── Email ─────────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">
              Identity
            </label>
            <input
              name="email"
              type="email"
              placeholder="name@company.com"
              required
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all text-sm font-medium
                focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900
                ${errors.email ? "border-red-300 bg-red-50" : "border-slate-100"}`}
            />
            <FieldError error={errors.email} />
          </div>

          {/* ── Password ──────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 ml-1">
              Security
            </label>

            <div className="space-y-2">
              <div>
                <input
                  name="password"
                  type="password"
                  placeholder="Create Password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all text-sm font-medium
                    focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900
                    ${errors.password
                      ? "border-red-300 bg-red-50"
                      : allRulesPassed && form.password
                        ? "border-emerald-300"
                        : "border-slate-100"
                    }`}
                />
                {form.password && !allRulesPassed && (
                  <PasswordStrength password={form.password} />
                )}
                <FieldError error={errors.password} />
              </div>

              <div>
                <input
                  name="password2"
                  type="password"
                  placeholder="Confirm Password"
                  required
                  value={form.password2}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all text-sm font-medium
                    focus:ring-2 focus:ring-slate-950 focus:bg-white text-slate-900
                    ${errors.password2
                      ? "border-red-300 bg-red-50"
                      : form.password2 && form.password === form.password2
                        ? "border-emerald-300"
                        : "border-slate-100"
                    }`}
                />
                <FieldError error={errors.password2} />
              </div>
            </div>
          </div>

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-950 text-white font-black text-[10px] uppercase tracking-[0.2em] py-3 rounded-xl hover:bg-slate-800 transition-all shadow-xl mt-1 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "Initializing..." : "Generate Identity"}
          </button>
        </form>

        {/* ── Google OAuth ───────────────────────────────────────────────── */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100" />
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

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <p className="mt-5 text-center text-[11px] text-slate-400 font-medium">
          Already part of the ecosystem?{" "}
          <Link
            to="/login"
            className="text-indigo-600 font-black hover:underline underline-offset-4 ml-1"
          >
            Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}