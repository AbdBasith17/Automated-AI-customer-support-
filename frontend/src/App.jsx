import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthGuard, VerifiedGuard } from "./components/ProtectedRoute";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyOTPPage from "./pages/VerifyOTPPage";

/**
 * NavigationWrapper 
 * Handles the logic for showing/hiding the Navbar based on the current URL.
 */
function NavigationWrapper() {
  const location = useLocation();
  
  // Only show the Navbar if the current path is exactly "/"
  const isLandingPage = location.pathname === "/";

  return isLandingPage ? <Navbar /> : null;
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        {/* This component checks the path and decides to render the Navbar or not */}
        <NavigationWrapper />
        
        <main>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<VerifyOTPPage />} />

            {/* Protected Dashboard Route */}
            <Route 
              path="/dashboard" 
              element={
                <AuthGuard>
                  <VerifiedGuard>
                    <div className="p-10">
                       <h1 className="text-2xl font-bold">Enterprise Dashboard</h1>
                       <p className="text-gray-600">Secure RAG interface loaded.</p>
                    </div>
                  </VerifiedGuard>
                </AuthGuard>
              } 
            />

            {/* Fallback to Home */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}