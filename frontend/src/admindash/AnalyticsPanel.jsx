import { useEffect, useState } from "react";
import {
  AreaChart, Area, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Ticket, Zap, Clock, Users, RefreshCw, CheckCircle } from "lucide-react";
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

const CachePerformance = ({ cache }) => {
  if (!cache) return <Empty />;

  const hitPct  = cache.total ? (cache.hits   / cache.total) * 100 : 0;
  const missPct = cache.total ? (cache.misses / cache.total) * 100 : 0;

  const pieData = [
    { name: "Hit",  value: cache.hits,   color: "#1d4ed8" },
    { name: "Miss", value: cache.misses, color: "#e2e8f0" },
  ];

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Full round donut */}
      <div className="relative w-[160px] h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black text-slate-900 leading-none">
            {hitPct.toFixed(1)}%
          </span>
          <span className="text-[10px] font-mono text-slate-400 mt-0.5 tracking-wide">
            HIT RATE
          </span>
        </div>
      </div>

      {/* Hit / Miss labels */}
      <div className="flex gap-6 text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-700 shrink-0" />
          <span className="text-slate-500">HIT</span>
          <span className="text-slate-900 font-semibold">{cache.hits.toLocaleString()}</span>
          <span className="text-slate-400">({hitPct.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
          <span className="text-slate-500">MISS</span>
          <span className="text-slate-900 font-semibold">{cache.misses.toLocaleString()}</span>
          <span className="text-slate-400">({missPct.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
};


export default function AnalyticsPanel() {
  const [dynamoTickets, setDynamoTickets] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [latency, setLatency] = useState([]);
  const [cache, setCache] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshed, setRefreshed] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const [t, l, c, q, dt] = await Promise.all([
      analyticsApi.getTicketVolume(30),
      analyticsApi.getLatency(7),
      analyticsApi.getCacheRate(),
      analyticsApi.getTopTopics(8),
      analyticsApi.getDynamoTickets(),
    ]);
    if (t.data)  setTickets(t.data.map(d => ({ date: d._id?.slice(5), count: d.count })));
    if (l.data)  setLatency(l.data.map(d => ({ date: d._id?.slice(5), p50: d.p50, p95: d.p95 })));
    if (c.data)  setCache(c.data);
    if (q.data)  setTopics(q.data.map(d => ({ topic: d.topic, count: d.count })));
    if (dt.data) setDynamoTickets(dt.data);
    setRefreshed(new Date().toLocaleTimeString());
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={loading ? "…" : (dynamoTickets?.open ?? 0)}
          sub={`${dynamoTickets?.total ?? 0} total sequences`}
          icon={<Ticket size={16} className="text-orange-600" />}
          accent="bg-orange-50"
        />
        <StatCard
          label="Closed Tickets"
          value={loading ? "…" : (dynamoTickets?.resolved ?? 0)}
          sub={
            dynamoTickets?.total
              ? `${Math.round((dynamoTickets.resolved / dynamoTickets.total) * 100)}% resolution rate`
              : "No actions recorded"
          }
          icon={<CheckCircle size={16} className="text-emerald-600" />}
          accent="bg-emerald-50"
        />
        <StatCard
          label="Avg P50 Latency"
          value={loading ? "…" : (avgP50 != null ? `${avgP50}ms` : "—")}
          sub="Non-cached AI responses"
          icon={<Clock size={16} className="text-amber-600" />}
          accent="bg-amber-50"
        />
        <StatCard
          label="Cache Hit Rate"
          value={loading ? "…" : `${hitPct}%`}
          sub={`${cache?.hits ?? 0} hits / ${cache?.total ?? 0} total`}
          icon={<Zap size={16} className="text-indigo-600" />}
          accent="bg-indigo-50"
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
        <ChartCard title="Top Query Topics" sub="By frequency" loading={loading}>
          <TopicsList topics={topics} />
        </ChartCard>

        <ChartCard title="Cache Performance" sub="Hit vs miss breakdown" loading={loading}>
          <CachePerformance cache={cache} />
        </ChartCard>
      </div>
    </div>
  );
}
