import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Pencil, Trash2, Check, X, Loader2,
  Plus, Ticket, PanelLeftClose, PanelLeftOpen, MessageSquare,
} from "lucide-react";
import { authApi } from "../api/auth";
import TicketModal from "../modal/TicketModal";
import {
  setChatList,
  selectChatList,
  selectSidebarVersion,
  clearChat,
} from "../store/slices/Chatslice";

const SkeletonItem = () => (
  <div className="px-4 py-3 rounded-xl animate-pulse bg-white/5 mb-2">
    <div className="h-2.5 bg-slate-800 rounded w-3/4 mb-1.5" />
    <div className="h-2 bg-slate-800/60 rounded w-1/2" />
  </div>
);

export default function Sidebar() {
  const navigate         = useNavigate();
  const dispatch         = useDispatch();
  const { urlSessionId } = useParams();

  const chats          = useSelector(selectChatList)      || [];
  const sidebarVersion = useSelector(selectSidebarVersion);

  const [isCollapsed,  setIsCollapsed]  = useState(false);
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [editingId,    setEditingId]    = useState(null);
  const [editValue,    setEditValue]    = useState("");
  const [savingId,     setSavingId]     = useState(null);
  const [deletingId,   setDeletingId]   = useState(null);
  const editInputRef = useRef(null);

  // ── Fetch chat sessions ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (chats.length === 0) setIsLoading(true);
      try {
        const chatRes = await authApi.getChatSessions();
        if (cancelled) return;
        if (chatRes.data) dispatch(setChatList(chatRes.data.chats || []));
      } catch (err) {
        console.error("[Sidebar] fetch error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [dispatch, urlSessionId, sidebarVersion]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    dispatch(clearChat());
    navigate("/chat");
  };

  const startEdit = (e, chat) => {
    e.stopPropagation();
    setEditingId(chat.session_id);
    setEditValue(chat.topic || "New Chat");
  };

  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditValue("");
  };

  const saveRename = async (e, sessionId) => {
    e?.stopPropagation();
    if (!editValue.trim()) return cancelEdit();
    setSavingId(sessionId);
    const { error } = await authApi.renameSession(sessionId, editValue.trim());
    if (!error) {
      dispatch(setChatList(
        chats.map(c =>
          c.session_id === sessionId ? { ...c, topic: editValue.trim() } : c
        )
      ));
    }
    setSavingId(null);
    setEditingId(null);
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this session?")) return;
    setDeletingId(sessionId);
    const { error } = await authApi.deleteSession(sessionId);
    if (!error) {
      dispatch(setChatList(chats.filter(c => c.session_id !== sessionId)));
      if (urlSessionId === sessionId) navigate("/chat");
    }
    setDeletingId(null);
  };

  // ── Collapsed state ────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed top-6 left-6 p-3 bg-slate-900 border border-white/10 rounded-xl text-slate-400 hover:text-white z-50 transition-all hover:bg-slate-800"
      >
        <PanelLeftOpen size={20} />
      </button>
    );
  }

  return (
    <>
      <div className="w-80 bg-slate-950 border-r border-white/5 h-screen flex flex-col p-6 z-30">

        {/* LOGO & COLLAPSE */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-white font-black italic tracking-tighter text-xl mb-1">AION_OS</h1>
            <div className="h-0.5 w-10 bg-indigo-500" />
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>

        {/* PRIMARY ACTIONS */}
        <div className="space-y-2 mb-8">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-3 w-full p-4 bg-white text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all shadow-lg shadow-indigo-500/10"
          >
            <Plus size={16} />
            Initialize_New
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 w-full p-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border border-white/5 transition-all"
          >
            <Ticket size={16} className="text-indigo-500" />
            Support_Tickets
          </button>
        </div>

        {/* SESSION HISTORY */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <h2 className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.3em] mb-4 font-bold px-1">
            Session_History
          </h2>

          <div className="space-y-1">
            {isLoading ? (
              <><SkeletonItem /><SkeletonItem /><SkeletonItem /></>
            ) : chats.length === 0 ? (
              <p className="text-slate-600 font-mono text-[9px] px-2 italic">
                Null_Set: No history found
              </p>
            ) : chats.map((c) => {
              const isActive   = urlSessionId === c.session_id;
              const isEditing  = editingId    === c.session_id;
              const isDeleting = deletingId   === c.session_id;
              const isSaving   = savingId     === c.session_id;

              return (
                <div
                  key={c.session_id}
                  onClick={() => !isEditing && navigate(`/chat/${c.session_id}`)}
                  className={`group px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all flex items-center gap-2 ${
                    isActive
                      ? "text-white bg-white/10 border border-white/5"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <MessageSquare
                    size={13}
                    className={`shrink-0 ${isActive ? "text-indigo-400" : "opacity-20"}`}
                  />

                  {isEditing ? (
                    /* ── Inline rename ──────────────────────────────────── */
                    <div
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter")  saveRename(e, c.session_id);
                          if (e.key === "Escape") cancelEdit(e);
                        }}
                        maxLength={40}
                        className="flex-1 min-w-0 bg-slate-800 text-white text-[11px] px-2 py-1 rounded outline-none border border-indigo-500/50"
                      />
                      {/* Save button */}
                      <button
                        onClick={e => saveRename(e, c.session_id)}
                        className="text-emerald-400 hover:text-emerald-300 shrink-0 p-0.5"
                        title="Save"
                      >
                        {isSaving
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Check size={12} />
                        }
                      </button>
                      {/* Cancel button */}
                      <button
                        onClick={cancelEdit}
                        className="text-slate-500 hover:text-slate-300 shrink-0 p-0.5"
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    /* ── Normal row ─────────────────────────────────────── */
                    <>
                      <p className="flex-1 truncate font-medium">
                        {c.topic || "New_Query"}
                      </p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={e => startEdit(e, c)}
                          className="p-1 text-slate-500 hover:text-white transition-colors"
                          title="Rename"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={e => handleDelete(e, c.session_id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          {isDeleting
                            ? <Loader2 size={11} className="animate-spin" />
                            : <Trash2 size={11} />
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 border border-white/10" />
            <div className="flex flex-col">
              <span className="text-white text-[10px] font-black uppercase tracking-widest">
                Engineer_Active
              </span>
              <span className="text-indigo-500 font-mono text-[8px] animate-pulse">
                ● CORE_CONNECTED
              </span>
            </div>
          </div>
        </div>
      </div>

      <TicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}