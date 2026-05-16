import { useEffect, useState, useCallback } from "react";
import { Users, ShieldCheck, UserCheck, UserX, RefreshCw, Crown } from "lucide-react";
import { adminApi } from "../api/adminApi";

// ── Reusable stat card — matches AnalyticsPanel's StatCard exactly ─────────
const StatCard = ({ label, value, sub, icon, accent }) => (
  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-start gap-4">
    <div className={`p-2.5 rounded-xl ${accent}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value ?? "—"}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ── Inline badge ───────────────────────────────────────────────────────────
const Badge = ({ label, className }) => (
  <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-md font-bold ${className}`}>
    {label}
  </span>
);

// ── Active toggle ──────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
      checked ? "bg-emerald-500" : "bg-slate-200"
    } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <span
      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
        checked ? "left-[18px]" : "left-0.5"
      }`}
    />
  </button>
);

// ── Filter select ──────────────────────────────────────────────────────────
const FilterSelect = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-[10px] font-mono uppercase tracking-widest bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 cursor-pointer"
  >
    {options.map(([v, label]) => (
      <option key={v} value={v}>{label}</option>
    ))}
  </select>
);

// ── Main component ─────────────────────────────────────────────────────────
export default function UserManagement() {
  const [analytics, setAnalytics] = useState(null);
  const [users,     setUsers]     = useState([]);
  const [meta,      setMeta]      = useState({ total: 0, page: 1, total_pages: 1 });
  const [loading,   setLoading]   = useState(true);
  const [toggling,  setToggling]  = useState({});
  const [refreshed, setRefreshed] = useState(null);
  const [filters,   setFilters]   = useState({
    search: "", is_active: "", is_mfa_enabled: "", role: "",
  });
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch analytics ──────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    const { data, error } = await adminApi.getUserAnalytics();
    if (data) {
      setAnalytics(data);
      setRefreshed(new Date().toLocaleTimeString());
    } else {
      showToast("Failed to load analytics", "error");
    }
  }, []);

  // ── Fetch users ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = { page, page_size: 15 };
    if (filters.search)         params.search         = filters.search;
    if (filters.is_active)      params.is_active      = filters.is_active;
    if (filters.is_mfa_enabled) params.is_mfa_enabled = filters.is_mfa_enabled;
    if (filters.role)           params.role           = filters.role;

    const { data, error } = await adminApi.getUsers(params);
    if (data) {
      setUsers(data.users);
      setMeta({ total: data.total, page: data.page, total_pages: data.total_pages });
    } else {
      showToast("Failed to load users", "error");
    }
    setLoading(false);
  }, [filters, page]);

  const fetchAll = useCallback(() => {
    fetchAnalytics();
    fetchUsers();
  }, [fetchAnalytics, fetchUsers]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { fetchUsers(); },    [fetchUsers]);

  // ── Toggle active ────────────────────────────────────────────────────────
  const toggleActive = async (user) => {
    setToggling((t) => ({ ...t, [user.id]: true }));
    const { error } = await adminApi.updateUser(user.id, { is_active: !user.is_active });
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u)
      );
      showToast(`${user.email} ${!user.is_active ? "activated" : "deactivated"}`);
    } else {
      showToast("Failed to update user", "error");
    }
    setToggling((t) => ({ ...t, [user.id]: false }));
  };

  // ── Change role ──────────────────────────────────────────────────────────
  const changeRole = async (user, role) => {
    const { error } = await adminApi.updateUser(user.id, { role });
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, role } : u)
      );
      showToast(`${user.email} → ${role}`);
    } else {
      showToast("Failed to update role", "error");
    }
  };

  const filterChange = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  // ── Avatar color derived from email ──────────────────────────────────────
  const avatarColor = (email) => {
    const colors = [
      "bg-indigo-100 text-indigo-700",
      "bg-violet-100 text-violet-700",
      "bg-emerald-100 text-emerald-700",
      "bg-amber-100 text-amber-700",
      "bg-rose-100 text-rose-700",
      "bg-sky-100 text-sky-700",
    ];
    return colors[email.charCodeAt(0) % colors.length];
  };

  // ── Pagination page numbers with ellipsis ────────────────────────────────
  const pageNumbers = Array.from({ length: meta.total_pages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === meta.total_pages || Math.abs(p - page) <= 1)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && arr[idx - 1] !== p - 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-xs font-mono shadow-xl border ${
          toast.type === "error"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
          {refreshed ? `Last updated: ${refreshed}` : "Loading..."}
        </p>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="Total Users"
          value={analytics?.total_users ?? "…"}
          sub={`+${analytics?.new_last_30d ?? 0} this month`}
          icon={<Users size={16} className="text-indigo-600" />}
          accent="bg-indigo-50"
        />
        <StatCard
          label="Active Users"
          value={analytics?.active_users ?? "…"}
          sub={`${analytics?.active_rate ?? 0}% of total`}
          icon={<UserCheck size={16} className="text-emerald-600" />}
          accent="bg-emerald-50"
        />
        <StatCard
          label="Inactive"
          value={analytics?.inactive_users ?? "…"}
          sub="Disabled accounts"
          icon={<UserX size={16} className="text-rose-600" />}
          accent="bg-rose-50"
        />
        <StatCard
          label="MFA Enabled"
          value={analytics?.mfa_enabled ?? "…"}
          sub={`${analytics?.mfa_rate ?? 0}% adoption`}
          icon={<ShieldCheck size={16} className="text-violet-600" />}
          accent="bg-violet-50"
        />
        <StatCard
          label="New (7 days)"
          value={analytics?.new_last_7d ?? "…"}
          sub="Recent signups"
          icon={<UserCheck size={16} className="text-sky-600" />}
          accent="bg-sky-50"
        />
        <StatCard
          label="Admins"
          value={analytics?.admin_count ?? "…"}
          sub="Privileged accounts"
          icon={<Crown size={16} className="text-amber-600" />}
          accent="bg-amber-50"
        />
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <input
          placeholder="Search by email or name…"
          value={filters.search}
          onChange={(e) => filterChange("search", e.target.value)}
          className="flex-1 min-w-[200px] text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
        />
        <FilterSelect
          value={filters.is_active}
          onChange={(v) => filterChange("is_active", v)}
          options={[["", "All Status"], ["true", "Active"], ["false", "Inactive"]]}
        />
        <FilterSelect
          value={filters.is_mfa_enabled}
          onChange={(v) => filterChange("is_mfa_enabled", v)}
          options={[["", "All MFA"], ["true", "MFA On"], ["false", "MFA Off"]]}
        />
        <FilterSelect
          value={filters.role}
          onChange={(v) => filterChange("role", v)}
          options={[["", "All Roles"], ["admin", "Admin"], ["user", "User"]]}
        />
        <span className="ml-auto text-[10px] font-mono text-slate-400 uppercase tracking-widest">
          {meta.total} result{meta.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                {["User", "Role", "Status", "MFA", "Verified", "Joined", "Active"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-[10px] font-mono uppercase tracking-widest text-slate-400 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                      <p className="text-[10px] font-mono text-slate-300 uppercase tracking-widest">
                        Loading users…
                      </p>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-[10px] font-mono text-slate-300 uppercase tracking-widest"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${
                      i % 2 === 1 ? "bg-slate-50/30" : ""
                    }`}
                  >
                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${avatarColor(user.email)}`}
                        >
                          {user.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{user.full_name || "—"}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate max-w-[180px]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value)}
                        className="text-[10px] font-mono uppercase tracking-widest bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:border-indigo-300 cursor-pointer"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <Badge
                        label={user.is_active ? "Active" : "Inactive"}
                        className={
                          user.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-600"
                        }
                      />
                    </td>

                    {/* MFA */}
                    <td className="px-5 py-3.5">
                      <Badge
                        label={user.is_mfa_enabled ? "Enabled" : "Off"}
                        className={
                          user.is_mfa_enabled
                            ? "bg-violet-50 text-violet-700"
                            : "bg-slate-100 text-slate-400"
                        }
                      />
                    </td>

                    {/* Verified */}
                    <td className="px-5 py-3.5">
                      <Badge
                        label={user.is_verified ? "Yes" : "No"}
                        className={
                          user.is_verified
                            ? "bg-sky-50 text-sky-700"
                            : "bg-amber-50 text-amber-600"
                        }
                      />
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3.5 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                      {new Date(user.date_joined).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Toggle */}
                    <td className="px-5 py-3.5">
                      <Toggle
                        checked={user.is_active}
                        onChange={() => toggleActive(user)}
                        disabled={!!toggling[user.id]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.total_pages > 1 && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100">
            <span className="text-[10px] font-mono text-slate-400 mr-2 uppercase tracking-widest">
              Page {meta.page} / {meta.total_pages}
            </span>
            {pageNumbers.map((p, idx) =>
              p === "…" ? (
                <span key={`e-${idx}`} className="text-slate-300 text-xs">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-[11px] font-mono transition-colors ${
                    p === page
                      ? "bg-indigo-600 text-white font-black shadow-sm shadow-indigo-200"
                      : "text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}