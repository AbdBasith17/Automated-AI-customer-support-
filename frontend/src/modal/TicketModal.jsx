import React, { useState, useEffect } from 'react';
import { X, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const TicketModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('open');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // LAZY LOAD: Fetch data only when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTickets();
    }
  }, [isOpen]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await authApi.getTickets();
      if (res.data && res.data.tickets) {
        setTickets(res.data.tickets);
        console.log(res)
      }
    } catch (err) {
      console.error("Support Portal Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJumpToSession = (sessionId) => {
    onClose(); // Close the modal first
    navigate(`/chat/${sessionId}`); // Navigate to the specific session route
  };

  if (!isOpen) return null;

  const filteredTickets = tickets.filter(t => t.status === activeTab);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight italic">Service Management</h2>
            <p className="text-[10px] text-indigo-400 font-mono mt-1 uppercase tracking-[0.3em]">AION_ELECTRIC // SUPPORT_PORTAL</p>
          </div>
          <button
            onClick={onClose}
            className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all border border-transparent hover:border-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-8 border-b border-white/5 bg-black/20">
          {['open', 'resolved'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-6 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
            >
              {tab} Instances
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-[10px] font-mono text-slate-500 tracking-[0.2em]">SYNCHRONIZING_DYNAMO_DB...</p>
            </div>
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => {
              const id = ticket.ticket_id;

              return (
                <div
                  key={id}
                  className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl group hover:border-indigo-500/30 transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-white font-bold tracking-tight">{id}</h3>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono ${ticket.status === 'open'
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>

                  {/* DYNAMIC VIEW SWITCHER */}
                  <p className="text-slate-400 text-xs leading-relaxed mb-4 line-clamp-2">
                    {ticket.status === 'open' ? (
                      // Display Summary if the ticket status is open
                      ticket.summary || "No description provided."
                    ) : (
                      
                      ticket.resolution_notes ? `Note: ${ticket.resolution_notes}` : "Issue resolved successfully."
                    )}

                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-mono">
                        REF: {id}
                      </span>
                    </div>
                    {ticket.session_id && (
                      <button
                        onClick={() => handleJumpToSession(ticket.session_id)}
                        className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1 transition-colors uppercase font-black tracking-widest"
                      >
                        Jump to session <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-700 opacity-50">
              <AlertCircle size={40} strokeWidth={1} />
              <p className="mt-4 text-[10px] font-bold tracking-[0.3em] uppercase italic">Zero {activeTab} sequences found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketModal;