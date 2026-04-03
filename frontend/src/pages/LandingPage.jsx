import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import ChatInterface from "../components/ChatInterface";

/**
 * Aion Support Ecosystem
 * Dedicated AI-Assistant Landing Page
 */
export default function LandingPage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="bg-white font-sans selection:bg-indigo-100 scroll-smooth">
      
      {/* --- HERO: CONTEXTUAL HEADER --- */}
      <section className="relative h-[70vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden bg-slate-950">
        {/* Animated Grid Pattern */}
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
            Access technical documentation, diagnostic data, and real-time hardware assistance through a single neural interface.
          </p>
          
          {!isLoggedIn ? (
            <Link 
              to="/login"
              className="bg-white text-slate-950 px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-2xl shadow-white/5"
            >
              Authenticate to Start Session
            </Link>
          ) : (
            <a 
              href="#support"
              className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-500/20"
            >
              Enter Support Console
            </a>
          )}
        </div>
      </section>

      {/* --- MAIN INTERFACE SECTION --- */}
      <section id="support" className="min-h-screen bg-slate-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          
          {/* Interface Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 italic mb-2">
                Neural Interface<span className="text-indigo-600">_</span>
              </h2>
              <p className="text-slate-500 font-medium">
                Ask questions about maintenance, specifications, or system errors.
              </p>
            </div>
            {isLoggedIn && (
              <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-4 py-2 rounded-lg">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                ENCRYPTED_CONNECTION
              </div>
            )}
          </div>

          {/* The "Chat-GPT" Style Hub */}
          <div className="relative rounded-[2rem] border border-slate-200 bg-white overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] h-[750px] flex flex-col">
            
            {isLoggedIn ? (
              /* The actual chat UI from our previous component */
              <ChatInterface />
            ) : (
              /* The Locked State Overlay (Visualizing Gemini/GPT style behind blur) */
              <div className="relative h-full w-full flex items-center justify-center">
                
                {/* Visual Mockup of a chat in background to entice login */}
                <div className="absolute inset-0 opacity-[0.03] p-12 pointer-events-none select-none">
                   <div className="space-y-8">
                      <div className="h-12 w-2/3 bg-slate-950 rounded-2xl" />
                      <div className="h-24 w-1/2 bg-slate-400 rounded-2xl ml-auto" />
                      <div className="h-16 w-3/4 bg-slate-950 rounded-2xl" />
                   </div>
                </div>

                {/* The Lock Content */}
                <div className="relative z-10 text-center px-12 animate-in fade-in zoom-in duration-700">
                  <div className="w-24 h-24 bg-slate-950 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-indigo-500/20 rotate-3">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  
                  <h3 className="font-display text-4xl font-black mb-4 text-slate-950">System Restricted.</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mb-10 font-medium text-lg leading-relaxed">
                    Personalized technical support and RAG-integrated diagnostics require owner authentication.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link 
                      to="/login" 
                      className="bg-slate-950 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                    >
                      Sign In
                    </Link>
                    <Link 
                      to="/register" 
                      className="bg-white border-2 border-slate-100 text-slate-950 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      Join Ecosystem
                    </Link>
                  </div>
                </div>
                
                {/* Glassmorphism Blur Layer */}
                <div className="absolute inset-0 backdrop-blur-md bg-white/40" />
              </div>
            )}
          </div>

          {/* Technical Specs Footer */}
          <div className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-4">
             {['End-to-End Encryption', 'Real-time Telemetry', 'Multi-modal RAG'].map((item) => (
               <div key={item} className="flex items-center gap-3">
                 <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                 <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400 font-bold">{item}</span>
               </div>
             ))}
          </div>

        </div>
      </section>
    </div>
  );
}