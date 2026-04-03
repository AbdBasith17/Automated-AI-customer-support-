import { useState } from "react";

/**
 * ChatInterface
 * The RAG-powered intelligence hub for Aion Stealth.
 */
export default function ChatInterface() {
  const [messages, setMessages] = useState([
    { 
      role: "ai", 
      content: "System online. I am your Aion Intelligence Assistant. How can I assist with your Stealth unit or Grid-Wall architecture today?" 
    }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: "user", content: input }]);
    // Logic for Django RAG API (Gemini/Groq pipeline) goes here
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      {/* Session Header - High Tech Branding */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
            Secure Handshake Established
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">
          RAG-v1.0.4
        </span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}
          >
            <div className={`max-w-[85%] md:max-w-[70%] px-6 py-4 rounded-[2rem] text-sm md:text-base leading-relaxed tracking-tight ${
              msg.role === 'user' 
                ? 'bg-slate-950 text-white rounded-tr-none shadow-xl shadow-slate-200' 
                : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              {/* Technical Indicator for AI responses */}
              {msg.role === 'ai' && (
                <span className="font-mono text-[9px] uppercase tracking-widest text-indigo-500 font-bold block mb-2">
                  Aion_Intel
                </span>
              )}
              <p className="font-medium">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Input Console */}
      <div className="p-6 bg-white">
        <div className="relative flex items-center group">
          <div className="absolute left-6 text-slate-300 group-focus-within:text-slate-950 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Transmit query to Aion Intelligence..."
            className="w-full pl-14 pr-20 py-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-2 focus:ring-slate-950 focus:bg-white outline-none text-slate-900 font-medium placeholder:text-slate-300 transition-all shadow-inner"
          />
          <button 
            onClick={handleSend}
            className="absolute right-3 p-3 bg-slate-950 text-white rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-90"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest px-2">Send</span>
          </button>
        </div>
        
        <div className="mt-4 flex justify-center">
          <p className="font-mono text-[9px] text-slate-300 uppercase tracking-[0.3em]">
            Precision Engineering • End-to-End Encryption
          </p>
        </div>
      </div>
    </div>
  );
}