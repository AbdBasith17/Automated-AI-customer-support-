import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatInterface from "../components/ChatInterface";

export default function ChatPage() {
  const { isLoggedIn, loading } = useAuth();
  const { urlSessionId } = useParams();

  if (loading) return null; 

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen bg-slate-950 flex overflow-hidden font-sans">
      {/* LEFT SIDEBAR */}
      <Sidebar />
      
      {/* MAIN CONTENT AREA */}
      <main className="relative flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        {/* Glassmorphism Chat Container */}
        <div className="relative z-10 flex-1 max-w-6xl w-full mx-auto bg-white border border-white/10 shadow-[0_0_50px_rgba(79,70,229,0.1)] rounded-[3rem] overflow-hidden flex flex-col">
          <ChatInterface key={urlSessionId || 'new'} />
        </div>
      </main>
    </div>
  );
}
