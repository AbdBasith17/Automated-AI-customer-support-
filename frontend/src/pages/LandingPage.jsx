import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function LandingPage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="bg-white font-sans selection:bg-indigo-100 scroll-smooth">
      {/* --- HERO SECTION --- */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-8 bg-slate-900/50 border border-slate-800 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-indigo-400 font-bold">
              RAG-Network Active
            </span>
          </div>
          
          <h1 className="font-display text-6xl md:text-8xl font-black tracking-tighter mb-6 italic text-white leading-tight">
            AION <span className="text-slate-700">CORE.</span>
          </h1>
          
          <p className="font-sans text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            The intelligent support layer for your Aion infrastructure. 
            Access technical documentation and real-time hardware assistance through a single neural interface.
          </p>
          
          <Link 
            to={isLoggedIn ? "/chat" : "/login"}
            className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-500/20"
          >
            {isLoggedIn ? "Open Intelligence Console" : "Authenticate to Start"}
          </Link>
        </div>
      </section>

      
      
    </div>
  );
}