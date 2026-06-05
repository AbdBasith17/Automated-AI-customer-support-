import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileUp, FileText, Trash2, CheckCircle2,
  Loader2, AlertCircle, Clock, RefreshCw, Database, X, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { documentApi } from "../api/documentApi";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  indexed:    { label: "Indexed",    color: "text-emerald-600", bg: "bg-emerald-50",  icon: <CheckCircle2 size={11} /> },
  processing: { label: "Processing", color: "text-blue-600",    bg: "bg-blue-50",     icon: <Loader2 size={11} className="animate-spin" /> },
  pending:    { label: "Pending",    color: "text-amber-600",   bg: "bg-amber-50",    icon: <Clock size={11} /> },
  failed:     { label: "Failed",     color: "text-red-500",     bg: "bg-red-50",      icon: <AlertCircle size={11} /> },
};

const StatusBadge = ({ status }) => {
  // Bulletproof mapping: force lowercase and trim spaces
  const safeStatus = (status || "").toLowerCase().trim();
  const cfg = STATUS[safeStatus] || STATUS.pending;
  
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, accent, sub }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4">
    <div className={`p-2.5 rounded-xl ${accent}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ── File type badge ───────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const colors = { pdf: "bg-red-50 text-red-600", docx: "bg-blue-50 text-blue-600", txt: "bg-slate-100 text-slate-500" };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${colors[type] || colors.txt}`}>
      {type}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function DocumentManager() {
  const [docs, setDocs]               = useState([]);
  const [files, setFiles]             = useState([]);
  const [fileProgress, setFileProgress] = useState({});  
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const fileInputRef                  = useRef(null);

  // Modal / Delete States
  const [docToDelete, setDocToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState("");

  // ── Fetch document list ────────────────────────────────────────────────────
  const fetchDocs = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    const { data, error } = await documentApi.list();
    if (data)  setDocs(data);
    if (error) toast.error("Failed to load documents");
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // ── Auto-poll while any doc is pending or processing ──────────────────────
  useEffect(() => {
    const hasActive = docs.some(d => {
      const s = (d.status || "").toLowerCase().trim();
      return s === "pending" || s === "processing";
    });
    
    if (!hasActive) return;
    const timer = setInterval(() => fetchDocs(true), 5000);
    return () => clearInterval(timer);
  }, [docs, fetchDocs]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = {
    total:      docs.length,
    indexed:    docs.filter(d => (d.status || "").toLowerCase().trim() === "indexed").length,
    processing: docs.filter(d => {
      const s = (d.status || "").toLowerCase().trim();
      return s === "pending" || s === "processing";
    }).length,
    failed:     docs.filter(d => (d.status || "").toLowerCase().trim() === "failed").length,
  };

  // ── File selection ─────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      return [...prev, ...selected.filter(f => !existingNames.has(f.name))];
    });
    e.target.value = ""; 
  };

  const removeFile = (index) => setFiles(files.filter((_, i) => i !== index));

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!files.length) return;
    setIsUploading(true);
    let successCount = 0;

    for (const file of files) {
      setFileProgress(prev => ({ ...prev, [file.name]: "uploading" }));
      const { error } = await documentApi.upload(file);

      if (error) {
        setFileProgress(prev => ({ ...prev, [file.name]: "error" }));
        toast.error(`Failed: ${file.name}`);
      } else {
        setFileProgress(prev => ({ ...prev, [file.name]: "done" }));
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? "s" : ""} uploaded`);
      await fetchDocs(true);
    }

    setTimeout(() => {
      setFiles([]);
      setFileProgress({});
      setIsUploading(false);
    }, 1200);
  };

  // ── Final Delete Execution ──────────────────────────────────────────────────
  const handleFinalDelete = async () => {
    if (confirmText.toLowerCase() !== "delete") return;
    
    const docId = docToDelete.id;
    const { error } = await documentApi.delete(docId);
    
    if (error) {
      toast.error("Purge failed", { description: "Infrastructure was unable to remove assets." });
    } else {
      toast.success("Document Purged", { description: "Vectors and S3 storage cleared." });
      setDocs(prev => prev.filter(d => d.id !== docId));
      closeDeleteModal();
    }
  };

  const closeDeleteModal = () => {
    setDocToDelete(null);
    setConfirmText("");
  };

  // ── File progress icon ─────────────────────────────────────────────────────
  const ProgressIcon = ({ name }) => {
    const state = fileProgress[name];
    if (state === "uploading") return <Loader2 size={14} className="animate-spin text-indigo-500" />;
    if (state === "done")      return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (state === "error")     return <AlertCircle size={14} className="text-red-500" />;
    return null;
  };

  return (
    <div className="space-y-8 max-w-5xl relative">

      {/* ── Confirmation Modal ─────────────────────────────────────────────── */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-red-50 rounded-2xl">
                  <AlertTriangle className="text-red-500" size={24} />
                </div>
                <button onClick={closeDeleteModal} className="text-slate-300 hover:text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-lg font-black text-slate-900 leading-tight">
                Purge "{docToDelete.title}"?
              </h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                This action is irreversible. Deleting this will remove all associated vectors from <span className="font-bold text-slate-700">ChromaDB</span>, metadata from the <span className="font-bold text-slate-700">AI Side</span>, and raw assets from storage.
              </p>

              <div className="mt-8 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Type <span className="text-red-500">DELETE</span> to confirm
                  </p>
                  <input
                    autoFocus
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type here..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-red-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={closeDeleteModal}
                    className="py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    Abort
                  </button>
                  <button
                    disabled={confirmText.toLowerCase() !== "delete"}
                    onClick={handleFinalDelete}
                    className="py-3 px-4 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest hover:bg-red-600 disabled:opacity-20 disabled:grayscale transition-all shadow-lg shadow-red-100"
                  >
                    Confirm Purge
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Documents" value={stats.total} sub="in knowledge base" icon={<Database size={16} className="text-indigo-600" />} accent="bg-indigo-50" />
        <StatCard label="Indexed" value={stats.indexed} sub="ready for RAG" icon={<CheckCircle2 size={16} className="text-emerald-600" />} accent="bg-emerald-50" />
        <StatCard label="Processing" value={stats.processing} sub={stats.processing > 0 ? "auto-refreshing..." : "queue empty"} icon={<Loader2 size={16} className={`text-blue-600 ${stats.processing > 0 ? "animate-spin" : ""}`} />} accent="bg-blue-50" />
        <StatCard label="Failed" value={stats.failed} sub={stats.failed > 0 ? "check server logs" : "all clear"} icon={<AlertCircle size={16} className="text-red-500" />} accent="bg-red-50" />
      </div>

      {/* ── Upload zone ───────────────────────────────────────────────────── */}
      <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div onClick={() => !isUploading && fileInputRef.current.click()} className="group border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer">
          <FileUp className="text-slate-300 group-hover:text-indigo-500 mb-4 transition-colors" size={40} />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Stage Documents</h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">PDF, DOCX, or TXT — each file uploaded individually</p>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept=".pdf,.docx,.txt" className="hidden" />
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Pending — {files.length} file{files.length > 1 ? "s" : ""}</p>
            {files.map((file, idx) => {
              const state = fileProgress[file.name];
              return (
                <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${state === "done" ? "bg-emerald-50 border-emerald-100" : state === "error" ? "bg-red-50 border-red-100" : state === "uploading" ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-100"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shrink-0"><FileText size={14} className="text-indigo-600" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[220px]">{file.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ProgressIcon name={file.name} />
                    {!isUploading && <button onClick={() => removeFile(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>}
                  </div>
                </div>
              );
            })}
            <button onClick={handleUpload} disabled={isUploading} className="w-full mt-2 bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isUploading ? <><Loader2 size={13} className="animate-spin" /> Indexing — do not close</> : `Commit ${files.length} File${files.length > 1 ? "s" : ""} to Vector Space`}
            </button>
          </div>
        )}
      </section>

      {/* ── Document library ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Infrastructure Library</h3>
          <button onClick={() => fetchDocs()} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors"><RefreshCw size={11} /> Refresh</button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <Database size={32} className="mb-3" />
              <p className="text-xs font-mono">No documents ingested yet</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Added</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileText size={14} className="text-slate-300 shrink-0" />
                        <span className="font-bold text-slate-700 text-xs truncate max-w-[220px]">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><TypeBadge type={doc.file_type} /></td>
                    <td className="px-6 py-4"><StatusBadge status={doc.status} /></td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">
                      {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setDocToDelete(doc)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}