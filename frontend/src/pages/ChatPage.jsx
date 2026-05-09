import ChatInterface from "../components/ChatInterface";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ChatPage() {
  const { isLoggedIn, isLoading } = useAuth();

  
  if (isLoading) return null; 

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      <main className="relative z-10 flex-1 flex flex-col pt-24 pb-8 px-4 md:px-8">
        <div className="flex-1 max-w-6xl w-full mx-auto bg-white border border-white/10 shadow-[0_0_50px_rgba(79,70,229,0.1)] rounded-[3rem] overflow-hidden flex flex-col">
          <ChatInterface />
        </div>
      </main>
    </div>
  );
}