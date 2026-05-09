import { useEffect, useState } from "react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Ticket, Zap, Clock, Users, RefreshCw } from "lucide-react";
import { analyticsApi } from "../api/analyticsApi";

const StatCard = ({ label, value, sub, icon, accent }) => (
  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-start gap-4">
    <div className={`p-2.5 rounded-xl ${accent}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const ChartCard = ({ title, sub, children, loading }) => (
  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
    <div className="mb-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{sub}</p>
      <h3 className="text-base font-black text-slate-900">{title}</h3>
    </div>
    {loading ? (
      <div className="flex items-center justify-center h-44">
        <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
      </div>
    ) : children}
  </div>
);

const Empty = () => (
  <div className="flex flex-col items-center justify-center h-44 text-slate-300">
    <p className="text-xs font-mono">No data yet</p>
    <p className="text-[10px] mt-1">Events will appear as users interact</p>
  </div>
);

const TOOLTIP_STYLE = {
  contentStyle: { background: "#0f172a", border: "none", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#94a3b8", fontFamily: "monospace" },
  itemStyle: { color: "#e2e8f0" },
};

// Clean ranked list for topics — no truncation issues
const TopicsList = ({ topics }) => {
  if (!topics.length) return <Empty />;
  const max = topics[0]?.count || 1;
  return (
    <div className="space-y-2.5 py-1">
      {topics.map((t, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-300 w-4 shrink-0">#{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]" title={t.topic}>
                {t.topic}
              </span>
              <span className="text-[10px] font-mono text-slate-400 ml-2 shrink-0">{t.count}x</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full">
              <div
                className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Cache performance card content
const CachePerformance = ({ cache }) => {
  if (!cache) return <Empty />;
  const hitPct = (cache.hit_rate * 100).toFixed(1);
  return (
    <div className="flex flex-col justify-center h-44 gap-5 px-1">
      <div className="text-center">
        <p className="text-5xl font-black text-slate-900">
          {hitPct}<span className="text-2xl text-slate-400">%</span>
        </p>
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-1">Cache Hit Rate</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400 w-10 text-right">{cache.hits}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${cache.total ? (cache.hits / cache.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-emerald-600 w-8">HIT</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400 w-10 text-right">{cache.misses}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-slate-300 h-1.5 rounded-full transition-all"
              style={{ width: `${cache.total ? (cache.misses / cache.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-400 w-8">MISS</span>
        </div>
      </div>
    </div>
  );
};

export default function AnalyticsPanel() {
  const [summary, setSummary] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [latency, setLatency] = useState([]);
  const [cache, setCache]     = useState(null);
  const [topics, setTopics]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshed, setRefreshed] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const [s, t, l, c, q] = await Promise.all([
      analyticsApi.getSummary(),
      analyticsApi.getTicketVolume(30),
      analyticsApi.getLatency(7),
      analyticsApi.getCacheRate(),
      analyticsApi.getTopTopics(8),
    ]);
    if (s.data) setSummary(s.data);
    if (t.data) setTickets(t.data.map(d => ({ date: d._id?.slice(5), count: d.count })));
    if (l.data) setLatency(l.data.map(d => ({ date: d._id?.slice(5), p50: d.p50, p95: d.p95 })));
    if (c.data) setCache(c.data);
    if (q.data) setTopics(q.data.map(d => ({ topic: d.topic, count: d.count })));
    setRefreshed(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const avgP50 = latency.length
    ? Math.round(latency.reduce((a, b) => a + (b.p50 || 0), 0) / latency.length)
    : null;
  const hitPct = cache ? (cache.hit_rate * 100).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* KPI cards — 4th is now Total Sessions */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Tickets"
          value={loading ? "…" : (summary?.total_tickets ?? 0)}
          sub={`${summary?.open_tickets ?? 0} open`}
          icon={<Ticket size={16} className="text-indigo-600" />}
          accent="bg-indigo-50"
        />
        <StatCard
          label="Cache Hit Rate"
          value={loading ? "…" : `${hitPct}%`}
          sub={`${cache?.hits ?? 0} hits / ${cache?.total ?? 0} total`}
          icon={<Zap size={16} className="text-emerald-600" />}
          accent="bg-emerald-50"
        />
        <StatCard
          label="Avg P50 Latency"
          value={loading ? "…" : (avgP50 != null ? `${avgP50}ms` : "—")}
          sub="Non-cached AI responses"
          icon={<Clock size={16} className="text-amber-600" />}
          accent="bg-amber-50"
        />
        {/* 4th card — Total Sessions instead of Top Issue */}
        <StatCard
          label="Total Sessions"
          value={loading ? "…" : (summary?.total_sessions ?? 0)}
          sub="Unique chat sessions"
          icon={<Users size={16} className="text-violet-600" />}
          accent="bg-violet-50"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Ticket Volume" sub="Last 30 days" loading={loading}>
          {tickets.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tickets}>
                <defs>
                  <linearGradient id="tickGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "monospace", fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "monospace", fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#tickGrad)" name="Tickets" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Response Latency" sub="P50 / P95 — last 7 days" loading={loading}>
          {latency.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={latency}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "monospace", fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "monospace", fill: "#94a3b8" }} unit="ms" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}ms`]} />
                <Line type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2} dot={false} name="P50" />
                <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="P95" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Topics — clean ranked list, no truncation issues */}
        <ChartCard title="Top Query Topics" sub="By frequency" loading={loading}>
          <TopicsList topics={topics} />
        </ChartCard>

        {/* Cache performance */}
        <ChartCard title="Cache Performance" sub="Hit vs miss breakdown" loading={loading}>
          <CachePerformance cache={cache} />
        </ChartCard>
      </div>
    </div>
  );
}