import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthTokens, Utilisateur, setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthContextType {
  user: Utilisateur | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (tokens: AuthTokens) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("m15_token");
    const storedUser = localStorage.getItem("m15_user");

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setAuthTokenGetter(() => localStorage.getItem("m15_token"));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("m15_token");
        localStorage.removeItem("m15_user");
        setAuthTokenGetter(null);
      }
    }
  }, []);

  const login = (tokens: AuthTokens) => {
    localStorage.setItem("m15_token", tokens.token);
    localStorage.setItem("m15_user", JSON.stringify(tokens.utilisateur));
    setToken(tokens.token);
    setUser(tokens.utilisateur);
    setAuthTokenGetter(() => localStorage.getItem("m15_token"));
  };

  const logout = () => {
    localStorage.removeItem("m15_token");
    localStorage.removeItem("m15_user");
    setToken(null);
    setUser(null);
    setAuthTokenGetter(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
