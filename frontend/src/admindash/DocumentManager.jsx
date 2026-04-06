import { useState, useRef } from "react";
import { FileUp, FileText, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DocumentManager() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Mock data for existing documents - replace with your API call to Django
  const [existingDocs, setExistingDocs] = useState([
    { id: 1, name: "Project_Aion_Specs.pdf", size: "2.4 MB", status: "indexed", date: "2026-04-01" },
    { id: 2, name: "System_Architecture_v2.docx", size: "1.1 MB", status: "indexed", date: "2026-03-28" },
  ]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    // Simulate API Call to your Django Ingestion Endpoint
    try {
      // await api.uploadDocuments(formData); 
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulation
      
      toast.success("Ingestion Complete", {
        description: `${files.length} documents added to Vector Space.`
      });
      setFiles([]);
    } catch (err) {
      toast.error("Ingestion Failed", { description: "Check server logs for RAG errors." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Upload Zone */}
      <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div 
          onClick={() => fileInputRef.current.click()}
          className="group border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer"
        >
          <FileUp className="text-slate-300 group-hover:text-indigo-500 mb-4 transition-colors" size={40} />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Stage Documents</h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">PDF, DOCX, or TXT for RAG Processing</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            className="hidden" 
          />
        </div>

        {/* Staged Files List */}
        {files.length > 0 && (
          <div className="mt-8 space-y-3 animate-in fade-in slide-in-from-top-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Pending Ingestion</p>
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <FileText size={16} className="text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{file.name}</span>
                </div>
                <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button 
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full mt-4 bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? <><Loader2 size={14} className="animate-spin" /> Indexing Knowledge...</> : "Commit to Vector Space"}
            </button>
          </div>
        )}
      </section>

      {/* Existing Library */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] px-1">Infrastructure Library</h3>
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Added</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {existingDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText size={14} className="text-slate-400" />
                      <span className="font-bold text-slate-700">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase tracking-wider">
                      <CheckCircle2 size={12} /> Indexed
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">{doc.date}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}