import { useState, useRef, useEffect } from "react";

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setHasStarted(true);
    setInput("");

    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "ai", 
        content: "Neural interface synchronized. Accessing requested documentation layers..." 
      }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      
      {/* HEADER: Updated to match Landing Page Hero Branding */}
      <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] font-black text-slate-900">
            AION_INTEL_ACTIVE
          </span>
        </div>
        <div className="px-3 py-1 bg-slate-100 rounded-full">
          <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500 font-bold">Encrypted Handshake</span>
        </div>
      </div>

      {/* INITIAL VIEW: Uses the Landing Page font styles */}
      {!hasStarted && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="text-center">
            <h1 className="font-display text-4xl md:text-5xl font-black italic tracking-tighter text-slate-950 mb-4">
              COMMAND <span className="text-slate-400">CENTER.</span>
            </h1>
            <p className="text-slate-500 text-sm md:text-base font-medium max-w-sm mx-auto leading-relaxed">
              Input your hardware query or technical requirement to begin retrieval.
            </p>
          </div>
        </div>
      )}

      {/* MESSAGE STREAM */}
      {hasStarted && (
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[80%] px-6 py-4 rounded-[2rem] text-[15px] leading-relaxed font-medium ${
                msg.role === 'user' 
                  ? 'bg-slate-950 text-white rounded-tr-none shadow-xl shadow-slate-200' 
                  : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'
              }`}>
                {msg.role === 'ai' && (
                   <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-indigo-600 font-black block mb-2">Neural_Core</span>
                )}
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      )}

      {/* INPUT AREA: Using the indigo-600 accent from your Landing Page button */}
      <div className="p-8 border-t border-slate-50 shrink-0 bg-white">
        <div className="relative group max-w-4xl mx-auto w-full">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Transmit query to Aion Core..."
            className="w-full pl-8 pr-32 py-6 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-indigo-50 focus:bg-white focus:border-indigo-200 outline-none text-slate-900 font-medium transition-all shadow-inner"
          />
          <button 
            onClick={handleSend}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
          >
            Transmit
          </button>
        </div>
        <p className="text-center mt-4 font-mono text-[9px] text-slate-300 uppercase tracking-[0.4em]">
          End-to-End Encrypted Hardware Diagnostics
        </p>
      </div>
    </div>
  );
}