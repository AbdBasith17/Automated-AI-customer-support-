import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

/**
 * AuthProvider: Manages global authentication state.
 * Handles session restoration on mount and provides login/logout methods.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Restores session by calling the /me/ endpoint.
   * Wrapped in try/catch to handle 401 (Unauthorized) or CORS errors
   */
  const checkSession = useCallback(async () => {
  let isMounted = true; 
  
  try {
    const { data } = await authApi.getMe();
    
    if (isMounted) {
      if (data && (data.user || data.email)) {
        setUser(data.user || data);
      } else {
        setUser(null);
      }
    }
  } catch (err) {
    if (isMounted) setUser(null);
  } finally {
    if (isMounted) setLoading(false);
  }

  return () => { isMounted = false; };
}, []);

  // Run session check on initial mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  /**
   * Standard Email/Password Login
   */
  const login = async (email, password) => {
    const { data, error } = await authApi.login(email, password);
    if (data?.user) {
      setUser(data.user);
    }
    return { data, error };
  };

  /**
   * Google OAuth Login
   */
  const loginWithGoogle = async (googleToken) => {
    try {
      const { data, error } = await authApi.googleLogin(googleToken);
      if (data?.user) {
        setUser(data.user);
      }
      return { data, error };
    } catch (err) {
      return { data: null, error: "Google login failed. Please try again." };
    }
  };

  /**
   * Logout: Clears state
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      
    }
  };

  
  const contextValue = useMemo(() => ({
    user,
    loading,
    setUser,
    login,
    logout,
    loginWithGoogle,
    checkSession,
    isLoggedIn: !!user,
    isVerified: !!user?.is_verified,
  }), [user, loading, checkSession]);

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading ? (
        children
      ) : (
        
        <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">Restoring session...</p>
        </div>
      )}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access AuthContext
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return context;
}