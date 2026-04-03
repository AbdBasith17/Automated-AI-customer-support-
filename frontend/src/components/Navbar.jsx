import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const initials = user ? `${user.first_name?.[0]}${user.last_name?.[0]}`.toUpperCase() : "??";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 font-sans">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-display text-2xl font-black italic tracking-tighter text-slate-950">AION</span>
          <div className="h-4 w-[1px] bg-slate-200 mx-1" />
          <span className="font-mono text-[9px] tracking-[0.3em] text-indigo-500 uppercase font-black">Intel</span>
        </Link>

        {/* Support Focused Links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#support" className="text-[11px] font-black uppercase tracking-widest text-slate-950 flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Support Console
          </a>
          <Link to="/docs" className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-950 transition-colors">Documentation</Link>
        </div>

        {/* Auth / Profile Area */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)} 
                className="w-10 h-10 rounded-xl bg-slate-950 text-white font-mono text-xs flex items-center justify-center shadow-xl hover:scale-105 transition-all"
              >
                {initials}
              </button>

              {/* Profile Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-slate-50 mb-2">
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Active Identity</p>
                    <p className="text-sm font-black text-slate-950 truncate">{user?.email}</p>
                  </div>
                  
                  <Link 
                    to="/profile" 
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-950 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile Settings
                  </Link>

                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all mt-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Terminate Session
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-5 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-950 transition-colors">Sign In</Link>
              <Link to="/register" className="px-6 py-3 text-[11px] font-black uppercase tracking-widest bg-slate-950 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all">Join Aion</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}