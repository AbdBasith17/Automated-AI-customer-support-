import { useState, useRef, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setSessionId,
  setChatHistory,
  addUserMessage,
  addAiMessage,
  setThinking,
  setChatError,
  selectMessages,
  selectThinking,
  selectChatError,
  selectSessionId,
} from "../store/slices/Chatslice";

// Get JWT token — checks localStorage (simplejwt default) then cookies
function getAccessToken() {
  // simplejwt stores token in localStorage when returned in response body
  const fromStorage =
    localStorage.getItem("access_token") ||
    localStorage.getItem("access");
  if (fromStorage) return fromStorage;

  // Fallback: cookie (if Django sets it via Set-Cookie)
  const cookies = Object.fromEntries(
    document.cookie
      .split(";")
      .map((c) => c.trim().split("=").map(decodeURIComponent))
      .filter((pair) => pair.length === 2)
  );
  return cookies["access_token"] || cookies["access"] || null;
}

// Build WebSocket URL using same host as page — works through nginx automatically
// ChatInterface.jsx

function buildWsUrl(sessionId) {
  // 1. Get the base API URL (e.g., http://localhost:8080/api)
  const apiUrl = import.meta.env.VITE_API_URL;

  // 2. Convert http/https to ws/wss and point to the ws path
  // This replaces 'http' with 'ws' and '/api' with '/api/ws/chat'
  const wsBase = apiUrl
    .replace(/^http/, "ws") 
    + `/ws/chat/${sessionId}/`;

  const token = getAccessToken();
  return token ? `${wsBase}?token=${token}` : wsBase;
}

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECTS     = 5;

export default function ChatInterface() {
  const [input, setInput]       = useState("");
  const scrollRef               = useRef(null);
  const wsRef                   = useRef(null);
  const reconnectCount          = useRef(0);
  const reconnectTimer          = useRef(null);
  const isMounted               = useRef(true);

  const dispatch   = useDispatch();
  const messages   = useSelector(selectMessages);
  const isThinking = useSelector(selectThinking);
  const apiError   = useSelector(selectChatError);
  const sessionId  = useSelector(selectSessionId);

  const hasStarted = messages.length > 0;

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // ── WebSocket connect ──────────────────────────────────────────────────────
  const connect = useCallback(
    (sid) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const url = buildWsUrl(sid);
      console.log("[WS] Connecting:", url.replace(/token=[^&]+/, "token=***"));
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected");
        reconnectCount.current = 0;
        dispatch(setChatError(null));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Initial history load on connect
          if (data.type === "chat_history") {
            dispatch(setChatHistory(data.messages || []));
            return;
          }

          // AI response
          if (data.role === "ai" || data.type === "new_message") {
            dispatch(addAiMessage(data.content));
            return;
          }
        } catch (e) {
          console.error("[WS] Message parse error:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        dispatch(setChatError("Connection error. Retrying..."));
      };

      ws.onclose = (event) => {
        console.log("[WS] Closed:", event.code);
        if (!isMounted.current) return;

        // Abnormal close — attempt reconnect
        if (event.code !== 1000 && reconnectCount.current < MAX_RECONNECTS) {
          reconnectCount.current += 1;
          console.log(`[WS] Reconnecting (${reconnectCount.current}/${MAX_RECONNECTS})...`);
          reconnectTimer.current = setTimeout(() => connect(sid), RECONNECT_DELAY_MS);
        } else if (reconnectCount.current >= MAX_RECONNECTS) {
          dispatch(setChatError("Connection lost. Please refresh the page."));
        }
      };
    },
    [dispatch]
  );

  // ── Mount — generate session + connect ────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    const sid = crypto.randomUUID();
    dispatch(setSessionId(sid));
    connect(sid);

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, [connect, dispatch]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || isThinking) return;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      dispatch(setChatError("Not connected. Please wait..."));
      return;
    }

    const userQuery = input.trim();
    setInput("");

    dispatch(addUserMessage(userQuery));

    ws.send(JSON.stringify({ message: userQuery }));
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
      <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isThinking ? "bg-indigo-600 animate-ping" : "bg-emerald-500"}`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] font-black text-slate-900">
            {isThinking ? "CORE_PROCESSING" : "AION_INTEL_ACTIVE"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {apiError && (
            <span className="text-red-500 font-mono text-[9px] font-bold animate-pulse uppercase">
              {apiError}
            </span>
          )}
          <div className="px-3 py-1 bg-slate-100 rounded-full">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500 font-bold">
              Secure Port 8080
            </span>
          </div>
        </div>
      </div>

      {/* MESSAGE STREAM */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scrollbar-hide">
        {!hasStarted && (
          <div className="h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
            <h1 className="font-display text-4xl md:text-6xl font-black italic tracking-tighter text-slate-950 mb-4 text-center">
              COMMAND <span className="text-slate-400">CENTER.</span>
            </h1>
            <p className="text-slate-500 text-sm md:text-base font-medium max-w-sm mx-auto leading-relaxed text-center">
              Initialize diagnostic sequence by entering your technical query below.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-4 duration-500`}
          >
            <div className={`max-w-[85%] md:max-w-[70%] px-6 py-4 rounded-[2rem] text-[15px] leading-relaxed font-medium transition-all ${
              msg.role === "user"
                ? "bg-slate-950 text-white rounded-tr-none shadow-2xl shadow-slate-200"
                : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none"
            }`}>
              {msg.role === "ai" && (
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-indigo-600 font-black block mb-2">
                  Aion_Intelligence
                </span>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-[2rem] rounded-tl-none w-2/3">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-indigo-400 font-black block mb-2">
                Analyzing...
              </span>
              <div className="space-y-2">
                <div className="h-2 bg-slate-200 rounded w-full" />
                <div className="h-2 bg-slate-200 rounded w-5/6" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* INPUT */}
      <div className="p-6 md:p-8 border-t border-slate-50 shrink-0 bg-white">
        <div className="relative group max-w-4xl mx-auto w-full">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking}
            placeholder={isThinking ? "Aion is processing..." : "Transmit query to Aion Core..."}
            className="w-full pl-8 pr-32 py-6 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-8 focus:ring-indigo-50 focus:bg-white focus:border-indigo-200 outline-none text-slate-900 font-medium transition-all shadow-inner disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 disabled:bg-slate-300 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
          >
            {isThinking ? "Sending" : "Transmit"}
          </button>
        </div>
      </div>
    </div>
  );
}