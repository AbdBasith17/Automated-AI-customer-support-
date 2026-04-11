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

function NavigationWrapper() {
  const location = useLocation();


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