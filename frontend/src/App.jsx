import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthGuard, VerifiedGuard, AdminGuard, GuestGuard } from "./components/ProtectedRoute";
import { Toaster } from "sonner";

// Pages
import LandingPage from "./pages/LandingPage";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyOTPPage from "./pages/VerifyOTPPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import AdminDashboard from "./admindash/AdminDashboard";


import UserResourceList from "./pages/UserResourceList";

function NavigationWrapper() {
  const location = useLocation();

  // We use .startsWith to ensure the Navbar shows up for /chat AND /chat/any-uuid
  const whiteList = ["/", "/docs", "/profile"];
  const isChatPath = location.pathname.startsWith("/chat");

  const showNavbar = whiteList.includes(location.pathname) || isChatPath;

  // Optional: If you want the Sidebar in ChatPage to be the only navigation, 
  // you might want to return null for isChatPath. 
  // For now, I'll keep it visible as per your original logic.
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

            <Route
              path="/login"
              element={
                <GuestGuard>
                  <LoginPage />
                </GuestGuard>
              }
            />
            <Route
              path="/register"
              element={
                <GuestGuard>
                  <RegisterPage />
                </GuestGuard>
              }
            />

            <Route path="/verify-otp" element={<VerifyOTPPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />

            {/* DYNAMIC CHAT ROUTE 
                The ":urlSessionId?" syntax makes the parameter optional.
                This allows both "/chat" and "/chat/123-abc" to work.
            */}
            <Route
              path="/chat/:urlSessionId?"
              element={
                <AuthGuard>
                  <VerifiedGuard>
                    <ChatPage />
                  </VerifiedGuard>
                </AuthGuard>
              }
            />
            {/* Added this block right above the /admin route */}
            <Route
              path="/docs"
              element={
                <AuthGuard>
                  <VerifiedGuard>
                    <UserResourceList />
                  </VerifiedGuard>
                </AuthGuard>
              }
            />

            <Route
              path="/admin"
              element={
                <AuthGuard>
                  <VerifiedGuard>
                    <AdminGuard>
                      <AdminDashboard />
                    </AdminGuard>
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