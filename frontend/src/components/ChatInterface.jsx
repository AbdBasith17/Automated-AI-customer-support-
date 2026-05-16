import { useState, useRef, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  setSessionId,
  setChatHistory,
  addUserMessage,
  addAiMessage,
  setChatError,
  selectMessages,
  selectThinking,
  selectChatError,
  selectSessionId,
  upsertChatInList,
  upsertTicketInList,  // ← was missing
  bumpSidebar,
} from "../store/slices/Chatslice";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECTS     = 5;

function buildWsUrl(sessionId) {
  const apiUrl   = import.meta.env.VITE_API_URL;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const base     = apiUrl
    ? apiUrl.replace(/^http/, "ws")
    : `${protocol}://${window.location.host}`;
  return `${base}/ws/chat/${sessionId}/`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ChatInterface() {
  const { urlSessionId } = useParams();
  const navigate         = useNavigate();
  const dispatch         = useDispatch();

  const [input, setInput]   = useState("");
  const scrollRef            = useRef(null);
  const wsRef                = useRef(null);
  const reconnectCount       = useRef(0);
  const reconnectTimer       = useRef(null);
  const isMounted            = useRef(true);

  const messages   = useSelector(selectMessages);
  const isThinking = useSelector(selectThinking);
  const apiError   = useSelector(selectChatError);
  const sessionId  = useSelector(selectSessionId);
  const hasStarted = messages.length > 0;

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connect = useCallback((sid) => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    const ws    = new WebSocket(buildWsUrl(sid));
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch(setChatError(null));
      reconnectCount.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "chat_history") {
          dispatch(setChatHistory(data.messages || []));
        }
        else if (data.type === "new_message" && data.role === "ai") {
          dispatch(addAiMessage(data.content));
        }
        else if (data.type === "sidebar_update") {
          // Optimistic update immediately, then re-fetch after GSI propagates
          dispatch(upsertChatInList({
            session_id: data.session_id,
            topic:      data.topic,
          }));
          setTimeout(() => dispatch(bumpSidebar()), 1500);
        }
        else if (data.type === "ticket_created" || data.type === "ticket_resolved") {
          dispatch(upsertTicketInList({
            ticket_key: data.payload?.ticket_key,
            status:     data.type === "ticket_resolved" ? "resolved" : "open",
            topic:      data.payload?.topic,
            session_id: data.payload?.session_id,
            resolved_at: data.payload?.resolved_at,
          }));
          dispatch(bumpSidebar());
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onerror = () => {
      if (!isMounted.current) return;
      console.error("[WS] Socket error on session:", sid);
    };

    ws.onclose = (event) => {
      if (!isMounted.current) return;

      if (event.code === 4001) {
        dispatch(setChatError("Session expired. Please refresh."));
        return;
      }

      if (event.code !== 1000 && reconnectCount.current < MAX_RECONNECTS) {
        reconnectCount.current += 1;
        reconnectTimer.current = setTimeout(() => {
          if (isMounted.current) connect(sid);
        }, RECONNECT_DELAY_MS);
      } else if (reconnectCount.current >= MAX_RECONNECTS) {
        dispatch(setChatError("Connection lost. Please refresh."));
      }
    };
  }, [dispatch]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    const activeSid   = urlSessionId || crypto.randomUUID();
    dispatch(setSessionId(activeSid));
    connect(activeSid);

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close(1000, "Session switch / unmount");
        wsRef.current = null;
      }
    };
  }, [urlSessionId, connect, dispatch]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || isThinking) return;

    // Guard: don't send if socket isn't open
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      dispatch(setChatError("Connection lost. Reconnecting..."));
      return;
    }

    const text = input.trim();
    setInput("");
    dispatch(addUserMessage(text));
    wsRef.current.send(JSON.stringify({ message: text }));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden font-sans">

      {/* HEADER */}
      <header className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full transition-all ${
            isThinking ? "bg-indigo-600 animate-pulse" : "bg-emerald-500"
          }`} />
          <span className="font-mono text-[10px] uppercase tracking-widest font-black text-slate-900">
            {isThinking ? "Core_Syncing" : "Aion_Active"}
          </span>
        </div>
        {apiError && (
          <span className="text-red-500 font-mono text-[9px] font-bold animate-pulse">
            {apiError}
          </span>
        )}
      </header>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto relative scrollbar-hide">
        <AnimatePresence mode="wait">
          {!hasStarted ? (

            /* ── Landing / initial state ─────────────────────────────────── */
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col items-center justify-center px-6"
            >
              <div className="max-w-2xl w-full text-center space-y-8">
                <div className="space-y-3">
                  <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-slate-950">
                    AION <span className="text-slate-300">ELECTRIC.</span>
                  </h1>
                  <p className="text-xl font-medium text-slate-500 italic">
                    {getGreeting()}. What can I help you with today?
                  </p>
                </div>

                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your technical query..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] p-8 pr-20 focus:ring-8 focus:ring-indigo-50 focus:bg-white focus:border-indigo-200 outline-none transition-all resize-none text-lg text-slate-900 shadow-sm"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="absolute bottom-6 right-6 p-4 bg-slate-950 text-white rounded-2xl hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>

          ) : (

            /* ── Chat messages ───────────────────────────────────────────── */
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-500`}
                >
                  <div className={`max-w-[85%] px-6 py-4 rounded-3xl text-[15px] leading-relaxed font-medium ${
                    msg.role === "user"
                      ? "bg-slate-950 text-white rounded-tr-none shadow-xl"
                      : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none"
                  }`}>
                    {msg.role === "ai" && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-indigo-600 font-black block mb-2">
                        Aion_Intelligence
                      </span>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start animate-pulse">
                  <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-3xl rounded-tl-none w-2/3">
                    <div className="h-2 bg-slate-200 rounded w-full mb-2" />
                    <div className="h-2 bg-slate-200 rounded w-4/5" />
                  </div>
                </div>
              )}

              <div ref={scrollRef} className="h-24" />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* DOCKED INPUT — only after first message */}
      {hasStarted && (
        <motion.footer
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="p-6 md:p-8 bg-white border-t border-slate-50"
        >
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking}
              placeholder={isThinking ? "Aion is thinking..." : "Transmit follow-up..."}
              className="w-full pl-8 pr-32 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-200 outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isThinking || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-3 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all"
            >
              {isThinking ? "Thinking..." : "Transmit"}
            </button>
          </div>
        </motion.footer>
      )}
    </div>
  );
}