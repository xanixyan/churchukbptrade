"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type SellerStatus = "active" | "pending_verification" | "banned" | "disabled";

interface SellerInfo {
  id: string;
  discordId: string;
  status: SellerStatus;
}

interface AuthState {
  isAuthenticated: boolean;
  seller: SellerInfo | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  refreshAuth: () => Promise<void>;
  setAuthState: (authenticated: boolean, seller: SellerInfo | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthStateInternal] = useState<AuthState>({
    isAuthenticated: false,
    seller: null,
    isLoading: true,
  });

  // Fetch auth state from server
  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/seller/auth", {
        credentials: "include",
      });
      const data = await response.json();

      setAuthStateInternal({
        isAuthenticated: data.authenticated || false,
        seller: data.seller || null,
        isLoading: false,
      });
    } catch (error) {
      console.error("Auth refresh error:", error);
      setAuthStateInternal({
        isAuthenticated: false,
        seller: null,
        isLoading: false,
      });
    }
  }, []);

  // Set auth state directly (for immediate updates after login/logout)
  const setAuthState = useCallback((authenticated: boolean, seller: SellerInfo | null) => {
    setAuthStateInternal({
      isAuthenticated: authenticated,
      seller,
      isLoading: false,
    });
  }, []);

  // Check auth on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        refreshAuth,
        setAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
