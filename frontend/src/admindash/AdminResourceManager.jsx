import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resourceApi } from "../api/resourceApi"; // Adjust import path

export default function AdminResourceManager() {
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const fetchResources = async () => {
    const { data, error } = await resourceApi.listAdmin();

    if (error) {
      toast.error("Failed to load resources");
      setIsLoading(false);
      return;
    }

    const resourceArray = Array.isArray(data) ? data : data?.results || [];
    setResources(resourceArray);
    setIsLoading(false);
  };

  useEffect(() => { fetchResources(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !name) return toast.error("Name and PDF are required");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("admin_given_name", name);
    formData.append("description", description);

    setIsUploading(true);
    const { error } = await resourceApi.upload(formData);

    if (error) {
      toast.error(error.error || error.message || "Upload failed");
      setIsUploading(false);
      return;
    }

    toast.success("Resource published successfully");
    setName("");
    setDescription("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await fetchResources();
    setIsUploading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this resource forever?")) return;
    const { error } = await resourceApi.delete(id);

    if (error) {
      toast.error("Failed to delete");
      return;
    }

    toast.success("Resource purged");
    setResources(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Upload Section */}
      <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] mb-6">Publish New Resource</h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" placeholder="e.g. Employee Handbook 2024" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">PDF File</label>
              <input type="file" required accept=".pdf" ref={fileInputRef} onChange={e => setSelectedFile(e.target.files[0])} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description (Optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 h-20" placeholder="Brief context about this document..." />
          </div>
          <button type="submit" disabled={isUploading} className="bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] py-3 px-6 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center gap-2">
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
            {isUploading ? "Uploading..." : "Publish to Users"}
          </button>
        </form>
      </section>

      {/* List Section */}
      <section className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resource Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Added</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {resources.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{doc.admin_given_name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-md">{doc.description}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
