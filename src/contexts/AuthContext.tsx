import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { authService, UserProfile } from '../services/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('auth-token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      // Optimistically mark as authenticated to persist session across refresh
      setIsAuthenticated(true);
      // Hydrate user from storage immediately for better UX
      const storedUser = localStorage.getItem('auth-user');
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)); } catch {}
      }
      // Refresh profile in background (do not flip auth off on failure)
      try {
        const profile = await authService.getProfile();
        setUser(profile);
      } catch {}
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await authService.login({ email, password });
    localStorage.setItem('auth-token', res.token);
    // Persist token renewal timestamp to manage session longevity
    localStorage.setItem('auth-token-updated-at', String(Date.now()));
    localStorage.setItem('auth-user', JSON.stringify(res.user));
    try {
      const profile = await authService.getProfile();
      setUser(profile);
      setIsAuthenticated(true);
      return profile;
    } catch {
      const fallbackUser = res.user as any as UserProfile;
      setUser(fallbackUser);
      setIsAuthenticated(true);
      return fallbackUser;
    }
  };

  const logout = async () => {
    try { await authService.logout(); } catch {}
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-token-updated-at');
    localStorage.removeItem('auth-user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
