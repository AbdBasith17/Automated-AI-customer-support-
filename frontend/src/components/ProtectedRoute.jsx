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



export const AdminGuard = ({ children }) => {
  const { user, isLoggedIn, loading } = useAuth();

 
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }


  if (!isLoggedIn || !user) {
    return <Navigate to="/login" replace />;
  }


  const hasAccess =  user.role === 'admin';

  if (!hasAccess) {
    return <Navigate to="/chat" replace />;
  }

  return children;
};


export const GuestGuard = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();

  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  
  if (isLoggedIn && user) {
    
    const isAdmin = user.role === 'admin';
    
    return <Navigate to={isAdmin ? "/admin" : "/chat"} replace />;
  }

  
  return children;
};