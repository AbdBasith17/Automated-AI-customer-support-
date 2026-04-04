import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthGuard, VerifiedGuard } from "./components/ProtectedRoute";
import { Toaster } from "sonner";

// Pages
import LandingPage from "./pages/LandingPage";
import ChatPage from "./pages/ChatPage"; 
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyOTPPage from "./pages/VerifyOTPPage";


function NavigationWrapper() {
  const location = useLocation();
  
  // Whitelist: The Navbar will only appear on these pages
  const whiteList = ["/", "/chat", "/docs", "/profile"];
  const showNavbar = whiteList.includes(location.pathname);

  return showNavbar ? <Navbar /> : null;
}

export default function App() {
  return (
    <Router> 
      <div className="min-h-screen bg-white">
        
        
        <NavigationWrapper />
        
        <Toaster richColors position="bottom-right" />
        
        <main>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<VerifyOTPPage />} />

            <Route 
              path="/chat" 
              element={
                <AuthGuard>
                  <VerifiedGuard>
                    <ChatPage /> 
                  </VerifiedGuard>
                </AuthGuard>
              } 
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}