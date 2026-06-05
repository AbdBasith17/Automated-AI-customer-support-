import { useState, useRef, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
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
  upsertChatInList,
  upsertTicketInList,
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

const MotionDiv = motion.div;
const MotionFooter = motion.footer;

export default function ChatInterface() {
  const { urlSessionId } = useParams();
  const dispatch         = useDispatch();

  const [input, setInput]   = useState("");
  const scrollRef            = useRef(null);
  const wsRef                = useRef(null);
  const reconnectCount       = useRef(0);
  const reconnectTimer       = useRef(null);
  const isMounted            = useRef(true);
  const connectRef           = useRef(null);

  const messages   = useSelector(selectMessages);
  const isThinking = useSelector(selectThinking);
  const apiError   = useSelector(selectChatError);
  const hasStarted = messages.length > 0;

  // ── VOICE SPEECH STATES (NEW CHANGES) ──────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
        setIsListening(false);
      };

      rec.onerror = (e) => {
        console.error("Speech recognition error", e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Voice to Text trigger
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice recognition is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // Text to Speech replay trigger
  const handleSpeak = (msgId, text) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (activeSpeakingId === msgId) {
        setActiveSpeakingId(null);
        return;
      }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setActiveSpeakingId(null);
    utterance.onerror = () => setActiveSpeakingId(null);

    setActiveSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

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
          if (isMounted.current) connectRef.current?.(sid);
        }, RECONNECT_DELAY_MS);
      } else if (reconnectCount.current >= MAX_RECONNECTS) {
        dispatch(setChatError("Connection lost. Please refresh."));
      }
    };
  }, [dispatch]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

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
      // Stop speech if navigating away
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [urlSessionId, connect, dispatch]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || isThinking) return;

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
            <MotionDiv
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
                    placeholder={isListening ? "Listening actively..." : "Describe your technical query..."}
                    rows={3}
                    className={`w-full bg-slate-50 border rounded-[2rem] p-8 pr-32 outline-none transition-all resize-none text-lg text-slate-900 shadow-sm ${
                      isListening ? "border-indigo-500 ring-8 ring-indigo-50 bg-indigo-50/10" : "border-slate-200 focus:ring-8 focus:ring-indigo-50 focus:bg-white focus:border-indigo-200"
                    }`}
                  />
                  
                  {/* Mic Action Button (Landing) */}
                  <button
                    onClick={toggleListening}
                    type="button"
                    className={`absolute bottom-6 right-20 p-4 rounded-2xl border transition-all ${
                      isListening 
                        ? "bg-red-500 text-white border-red-600 animate-pulse shadow-red-100" 
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    }`}
                    title="Speak message"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>

                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isListening}
                    className="absolute bottom-6 right-6 p-4 bg-slate-950 text-white rounded-2xl hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </MotionDiv>

          ) : (

            /* ── Chat messages ───────────────────────────────────────────── */
            <MotionDiv
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
                      <div className="flex items-center justify-between mb-2 gap-8">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-indigo-600 font-black block">
                          Aion_Intelligence
                        </span>
                        
                        {/* Speaker Output Button */}
                        <button
                          onClick={() => handleSpeak(msg.id, msg.content)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            activeSpeakingId === msg.id 
                              ? "bg-indigo-600 text-white border-indigo-700 animate-bounce" 
                              : "text-slate-400 border-slate-200 bg-white hover:text-slate-900 hover:border-slate-300"
                          }`}
                          title={activeSpeakingId === msg.id ? "Stop reading" : "Read aloud"}
                        >
                          {activeSpeakingId === msg.id ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z" />
                            </svg>
                          )}
                        </button>
                      </div>
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
            </MotionDiv>
          )}
        </AnimatePresence>
      </main>

      {/* DOCKED INPUT — only after first message */}
      {hasStarted && (
        <MotionFooter
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
              placeholder={
                isListening 
                  ? "Listening actively..." 
                  : isThinking 
                    ? "Aion is thinking..." 
                    : "Transmit follow-up..."
              }
              className={`w-full pl-8 pr-44 py-5 bg-slate-50 border rounded-2xl outline-none transition-all disabled:opacity-50 ${
                isListening ? "border-indigo-500 bg-indigo-50/10 ring-4 ring-indigo-50" : "border-slate-100 focus:bg-white focus:border-indigo-200"
              }`}
            />
            
            {/* Mic Action Button (Docked Footer) */}
            <button
              onClick={toggleListening}
              disabled={isThinking}
              type="button"
              className={`absolute right-32 top-1/2 -translate-y-1/2 p-2.5 rounded-xl border transition-all ${
                isListening 
                  ? "bg-red-500 text-white border-red-600 animate-pulse" 
                  : "bg-white text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
              }`}
              title="Speak message"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              onClick={handleSend}
              disabled={isThinking || !input.trim() || isListening}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-3 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all"
            >
              {isThinking ? "Thinking..." : "Transmit"}
            </button>
          </div>
        </MotionFooter>
      )}
    </div>
  );
}
