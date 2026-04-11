
import { createContext, useContext, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectUser,
  selectAuthLoading,
  selectIsLoggedIn,
  selectIsVerified,
  setUser,
  checkSession,
  loginUser,
  logoutUser,
  loginWithGoogleThunk,
} from "../store/slices/authslice";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const loading = useSelector(selectAuthLoading);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isVerified = useSelector(selectIsVerified);

  // Restore session on mount
  useEffect(() => {
    dispatch(checkSession());
  }, [dispatch]);

  /**
   * login — returns { data, error } like the old AuthContext so pages don't change.
   * The Redux thunk still fires so the store stays in sync.
   */
  const login = useCallback(
    async (email, password) => {
      try {
        const data = await dispatch(loginUser({ email, password })).unwrap();
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    [dispatch]
  );

  const loginWithGoogle = useCallback(
    async (token) => {
      try {
        const data = await dispatch(loginWithGoogleThunk(token)).unwrap();
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    await dispatch(logoutUser());
  }, [dispatch]);

  const handleSetUser = useCallback(
    (userData) => dispatch(setUser(userData)),
    [dispatch]
  );

  const handleCheckSession = useCallback(
    () => dispatch(checkSession()),
    [dispatch]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isLoggedIn,
      isVerified,
      setUser: handleSetUser,
      login,
      logout,
      loginWithGoogle,
      checkSession: handleCheckSession,
    }),
    [user, loading, isLoggedIn, isVerified, handleSetUser, login, logout, loginWithGoogle, handleCheckSession]
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
            <div className="h-12 w-12 rounded-full border-4 border-slate-800 border-t-indigo-300 animate-spin absolute inset-0 [animation-duration:1.4s]" />
          </div>
          <p className="mt-5 font-mono text-[10px] text-slate-500 uppercase tracking-[0.3em]">
            Restoring session...
          </p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
