import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth"; 
import { toast } from "sonner";
import MFASetupModal from "./MFASetupModal";

export default function Navbar() {
  const { user, setUser, isLoggedIn, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [loadingMfa, setLoadingMfa] = useState(false);

  // ── Auto-hide state (chat page only) ──────────────────────────────────────
  const [navVisible, setNavVisible] = useState(false);
  const hideTimerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const isChatPage = location.pathname.startsWith("/chat");

  const fullName = user ? `${user.first_name || ""} ${user.last_name || ""}` : "Guest User";
  const initials = user ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() : "??";

  const isActive = (path) => location.pathname === path;

  // ── Show/hide helpers ──────────────────────────────────────────────────────
  const showNav = () => {
    clearTimeout(hideTimerRef.current);
    setNavVisible(true);
  };

  const scheduleHide = () => {
    // Only auto-hide on chat page and when dropdown is closed
    if (!isChatPage) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!dropdownOpen) setNavVisible(false);
    }, 2000); // 2s after cursor leaves
  };

  // Reset visibility whenever we leave/enter the chat page
  useEffect(() => {
    if (!isChatPage) {
      setNavVisible(true);
      clearTimeout(hideTimerRef.current);
    } else {
      setNavVisible(false);
    }
    return () => clearTimeout(hideTimerRef.current);
  }, [isChatPage]);

  // Keep nav visible while dropdown is open
  useEffect(() => {
    if (dropdownOpen && isChatPage) {
      clearTimeout(hideTimerRef.current);
    } else if (!dropdownOpen && isChatPage) {
      scheduleHide();
    }
  }, [dropdownOpen]);

  // ── Trigger MFA Setup ──────────────────────────────────────────────────────
  const handleEnableMFA = async () => {
    setDropdownOpen(false);
    setLoadingMfa(true);

    const { data, error } = await authApi.setupMfa();

    if (error) {
      toast.error("Handshake Failed", { description: "Security layers are offline." });
      setLoadingMfa(false);
      return;
    }

    if (data?.qr_code) {
      setQrCode(data.qr_code);
      setShowMfaModal(true);
    }
    setLoadingMfa(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoutRequest = () => {
    setDropdownOpen(false);
    toast("Terminate Session?", {
      description: "Are you sure you want to log out of AION Core?",
      action: {
        label: "Confirm Logout",
        onClick: () => {
          logout();
          toast.success("Session terminated safely.");
          navigate("/");
        },
      },
    });
  };

  const handleProtectedAction = (e, path, type) => {
    if (!isLoggedIn) {
      e.preventDefault();
      toast.error("Access Restricted", {
        description: `Please authenticate to access the ${type} system.`,
        action: { label: "Login", onClick: () => navigate("/login") },
      });
      return;
    }

    if (isLoggedIn && path === "/docs" && !user?.is_mfa_enabled) {
      e.preventDefault();
      toast("Security Clearance Required", {
        description: "Enable multifactor authentication to access core docs.",
        action: {
          label: "Enable Now",
          onClick: () => handleEnableMFA()
        },
      });
    }
  };

  const BlinkingStatus = () => (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
  );

  return (
    <>
      {/* ── Hover trigger zone (chat page only) ─────────────────────────────
          A thin invisible strip at the top of the viewport. Hovering it
          slides the navbar down into view.                                  */}
      {isChatPage && (
        <div
          onMouseEnter={showNav}
          className="fixed top-0 left-0 right-0 h-4 z-[60]"
          aria-hidden="true"
        />
      )}

      {/* ── Navbar wrapper ───────────────────────────────────────────────── */}
      <div
        onMouseEnter={isChatPage ? showNav : undefined}
        onMouseLeave={isChatPage ? scheduleHide : undefined}
        className={`
          fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl
          transition-all duration-300 ease-in-out
          ${isChatPage
            ? navVisible
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-8 pointer-events-none"
            : "opacity-100 translate-y-0 pointer-events-auto"
          }
        `}
      >
        <nav className="bg-white/80 backdrop-blur-2xl border border-slate-200/50 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.05)] px-8 h-20 flex items-center justify-between">

          <div className="flex-1 flex justify-start">
            <Link to="/" className="flex items-center gap-3 group">
              <span className="font-display text-2xl font-black italic tracking-tighter text-slate-950">AION</span>
              <div className="h-6 w-[1.5px] bg-slate-200 mx-1" />
              <div className="flex flex-col justify-center">
                <span className="font-mono text-[14px] tracking-[0.4em] text-slate-950 uppercase font-black leading-none mb-1">CORE</span>
                <span className="font-mono text-[11px] tracking-[0.4em] text-indigo-600 uppercase font-black leading-none">ASSIST</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-full border border-slate-200/20">
            <Link to="/" className={`text-[11px] font-black uppercase tracking-widest px-6 py-2.5 rounded-full flex items-center gap-2 transition-all ${isActive("/") ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
              {isActive("/") && <BlinkingStatus />} Home
            </Link>

            <Link to="/chat" onClick={(e) => handleProtectedAction(e, "/chat", "Chat")} className={`text-[11px] font-black uppercase tracking-widest px-6 py-2.5 rounded-full flex items-center gap-2 transition-all ${isActive("/chat") ? "bg-slate-950 text-white shadow-lg" : "text-slate-400 hover:text-slate-950"}`}>
              {isActive("/chat") && <BlinkingStatus />} Chat
            </Link>

            <Link to="/docs" onClick={(e) => handleProtectedAction(e, "/docs", "Documentation")} className={`text-[11px] font-black uppercase tracking-widest px-6 py-2.5 rounded-full flex items-center gap-2 transition-all ${isActive("/docs") ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-950"}`}>
              {isActive("/docs") && <BlinkingStatus />} Docs
            </Link>
          </div>

          <div className="flex-1 flex justify-end">
            {isLoggedIn ? (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-11 h-11 rounded-full bg-slate-950 text-white font-mono text-xs flex items-center justify-center shadow-md hover:scale-105 transition-all border-2 border-white ring-1 ring-slate-200">
                  {initials}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-4 w-[340px] bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl p-3 animate-in fade-in zoom-in-95">
                    {/* Profile Header */}
                    <div className="px-5 py-5 border-b border-slate-50 mb-2">
                      <p className="text-sm font-black text-slate-950">{fullName}</p>
                      <p className={`text-[10px] font-mono uppercase tracking-widest mt-0.5 transition-colors duration-300 ${user?.is_mfa_enabled ? 'text-emerald-500' : 'text-indigo-500'}`}>
                        {user?.is_mfa_enabled ? "✓ Secure Operator" : "Verified Operator"}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-2 font-medium">{user?.email}</p>
                    </div>

                    {/* MFA STATUS BUTTON */}
                    <button
                      onClick={handleEnableMFA}
                      disabled={loadingMfa || user?.is_mfa_enabled}
                      className={`w-full flex items-center justify-between px-5 py-4 text-xs font-bold rounded-2xl transition-all mb-1 border ${
                        user?.is_mfa_enabled
                          ? "text-emerald-700 bg-emerald-50 border-emerald-100 cursor-default"
                          : "text-slate-950 bg-slate-50 hover:bg-slate-100 border-transparent shadow-sm"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {user?.is_mfa_enabled ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            MFA Protection Active
                          </>
                        ) : (
                          loadingMfa ? "Initializing Security..." : "Enable Multifactor Authentication"
                        )}
                      </span>

                      {!user?.is_mfa_enabled && !loadingMfa && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      )}
                    </button>

                    {/* Logout Action */}
                    <button onClick={handleLogoutRequest} className="w-full flex items-center gap-3 px-5 py-4 text-xs font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Link to="/login" className="px-5 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-950">Login</Link>
                <Link to="/register" className="px-6 py-2.5 text-[11px] font-black uppercase tracking-widest bg-slate-950 text-white rounded-full shadow-lg hover:bg-slate-800 transition-all">Join</Link>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* ── Floating hint pill (chat page only, when navbar is hidden) ──────
          A subtle indicator so users know the navbar is reachable.          */}
      {isChatPage && !navVisible && (
        <div
          onMouseEnter={showNav}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1 bg-slate-950/60 backdrop-blur-sm rounded-full border border-white/10 cursor-pointer transition-opacity duration-300 hover:opacity-100 opacity-40"
        >
          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse [animation-delay:150ms]" />
          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse [animation-delay:300ms]" />
        </div>
      )}

      {/* MODAL LAYER */}
      {showMfaModal && (
        <MFASetupModal
          qrCode={qrCode}
          onClose={() => setShowMfaModal(false)}
          onSuccess={() => {
            setShowMfaModal(false);
            setUser({ ...user, is_mfa_enabled: true }); 
          }}
        />
      )}
    </>
  );
}