import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


export const AuthGuard = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
   
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};


export const VerifiedGuard = ({ children }) => {
  const { user, isLoggedIn, loading } = useAuth(); // Add loading here

  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  
  
  if (!user?.is_verified) {
    return <Navigate to={`/verify-otp?email=${encodeURIComponent(user?.email)}`} replace />;
  }

  return children;
};