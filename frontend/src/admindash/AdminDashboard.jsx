import { useDispatch, useSelector } from "react-redux";
import { FileUp, Settings, Activity, BarChart3, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { setAdminTab, selectAdminTab } from "../store/slices/Uislice";
import DocumentManager from "./DocumentManager";

import AnalyticsPanel from "./AnalyticsPanel";

const SystemPending = ({ title }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
    <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin mb-4" />
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Initializing {title}...</h3>
    <p className="text-[10px] text-slate-300 font-mono mt-1 italic">Module connection in progress</p>
  </div>
);

export default function AdminDashboard() {
  const dispatch = useDispatch();
  const activeTab = useSelector(selectAdminTab); 
  const { logout, user } = useAuth();

  const menuItems = [
    { id: "analytics", label: "Insights",       icon: <BarChart3 size={18} /> },
    { id: "docs",      label: "Knowledge Base",  icon: <FileUp size={18} />   },
    { id: "config",    label: "Integrations",    icon: <Settings size={18} /> },
    { id: "logs",      label: "System Logs",     icon: <Activity size={18} /> },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="w-72 bg-slate-950 p-8 flex flex-col border-r border-slate-800 shrink-0">
        <div className="mb-10">
          <h1 className="text-white font-black tracking-[0.2em] text-sm italic">AION_CORE // ADMIN</h1>
          <p className="text-slate-500 text-[10px] uppercase font-mono mt-1">Infrastructure Control</p>
        </div>

        <nav className="space-y-1.5 flex-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => dispatch(setAdminTab(item.id))}  
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-bold ${
                activeTab === item.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {item.icon}
              {item.label}
              {activeTab === item.id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-300" />
              )}
            </button>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="pt-6 border-t border-slate-800 space-y-3">
          {user && (
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div>
                <p className="text-slate-300 text-xs font-bold">{user.first_name} {user.last_name}</p>
                <p className="text-slate-600 text-[10px] font-mono truncate max-w-[140px]">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest hover:text-red-300 transition-colors px-1"
          >
            <LogOut size={12} />
            Terminate Session
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-12">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.3em] mb-1">
              {menuItems.find((m) => m.id === activeTab)?.id}
            </p>
            <h2 className="text-3xl font-black text-slate-900">
              {menuItems.find((m) => m.id === activeTab)?.label}
            </h2>
            <p className="text-slate-500 text-sm mt-1">Managing the Aion RAG cluster real-time.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest px-3 py-1.5 bg-slate-100 rounded-full">
              Backend: Operational
            </span>
          </div>
        </header>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" key={activeTab}>
          {activeTab === "docs"      && <DocumentManager />}
          {activeTab === "analytics" && <AnalyticsPanel />}
          {activeTab === "config"    && <SystemPending title="API Connectors" />}
          {activeTab === "logs"      && (
            <div className="bg-slate-900 rounded-3xl p-8 font-mono text-xs text-green-400 min-h-[450px] border border-slate-800 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
              <p className="text-indigo-400 mb-4 font-black tracking-widest">[KERNEL_AION] LOG STREAM ACTIVE</p>
              {[
                "[08:42:01] ChromaDB Heartbeat: OK",
                "[08:42:05] Celery Worker (whatsapp_queue): Idle",
                "[08:42:10] Ingestion Pipeline: Awaiting Files",
                "[08:42:15] Redis Cache: Connected",
                "[08:42:20] Django ORM: Query cache warm",
              ].map((log, i) => (
                <p key={i} className="text-slate-500 mb-1">{log}</p>
              ))}
              <p className="mt-4 animate-pulse text-indigo-400">_</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
