import { useState, useEffect } from "react";
import { FileText, Download, Eye, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { resourceApi } from "../api/resourceApi"; 

export default function UserResourceList() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingId, setViewingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const fetchDocs = async () => {
      const { data, error } = await resourceApi.listUser();

      if (error) {
        toast.error("Failed to load documents");
        setIsLoading(false);
        return;
      }

      setDocuments(Array.isArray(data) ? data : []);
      setIsLoading(false);
    };
    fetchDocs();
  }, []);

  const handleAction = async (id, actionType) => {
    if (actionType === "view") setViewingId(id);
    else setDownloadingId(id);

    const { data, error } = await resourceApi.getUrl(id, actionType);

    if (error || !data?.url) {
      toast.error(`Unable to ${actionType} document`);
      setViewingId(null);
      setDownloadingId(null);
      return;
    }

    if (actionType === "view") {
      window.open(data.url, "_blank", "noopener,noreferrer");
    } else {
      const link = document.createElement("a");
      link.href = data.url;
      link.setAttribute("download", data.name || "document.pdf");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setViewingId(null);
    setDownloadingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-indigo-600" size={40} />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Loading library assets...</p>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-slate-50/30 pt-36 pb-12 px-4 sm:px-6 lg:px-8">
    <div className="max-w-6xl mx-auto">
        
        {/* Modern Header Design */}
        <header className="mb-12 border-b border-slate-200/60 pb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Resource Library
            </h1>
            <p className="text-base text-slate-500 mt-2 max-w-xl">
              Access administrative documentation, operational standard manuals, and technical guides.
            </p>
          </div>
          <div className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-semibold text-slate-600 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            {documents.length} Available {documents.length === 1 ? "Resource" : "Resources"}
          </div>
        </header>

        {/* Premium Document Matrix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div 
              key={doc.id} 
              className="bg-white border border-slate-200/80 rounded-2xl p-6 hover:shadow-[0_10px_30px_-15px_rgba(0,0,0,0,08)] hover:border-indigo-200/80 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div>
                {/* Upper Details Row */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    <FileText size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider mb-1">
                      PDF Document
                    </span>
                    <h3 className="font-bold text-slate-800 text-lg leading-snug truncate group-hover:text-indigo-900 transition-colors" title={doc.admin_given_name}>
                      {doc.admin_given_name}
                    </h3>
                  </div>
                </div>
                
                {/* Description block */}
                <p className="text-sm text-slate-500 leading-relaxed mb-6 line-clamp-3">
                  {doc.description || "No specific abstract or description context attached to this library resource item."}
                </p>
              </div>

              {/* Bottom Card Area */}
              <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <Calendar size={13} />
                  <span>Uploaded {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>

                {/* Separated View & Download Button Architecture */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleAction(doc.id, "view")}
                    disabled={viewingId === doc.id || downloadingId === doc.id}
                    className="py-2.5 px-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-slate-200/80 shadow-sm disabled:opacity-50"
                  >
                    {viewingId === doc.id ? (
                      <Loader2 size={14} className="animate-spin text-slate-400" />
                    ) : (
                      <Eye size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    )}
                    View Preview
                  </button>

                  <button 
                    onClick={() => handleAction(doc.id, "download")}
                    disabled={viewingId === doc.id || downloadingId === doc.id}
                    className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-indigo-100/50 group-hover:shadow-sm disabled:opacity-50"
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Empty State Layout */}
          {documents.length === 0 && (
            <div className="col-span-full py-24 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200/60 shadow-sm p-8">
              <div className="p-4 bg-slate-50 rounded-full mb-4 text-slate-400 border border-slate-100">
                <FileText size={40} className="text-slate-300" />
              </div>
              <h3 className="font-bold text-xl text-slate-800">No resources available</h3>
              <p className="text-sm text-slate-400 max-w-xs mt-1">There are currently no administrative assets or documentation artifacts published to your user space.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
