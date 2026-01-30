"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type UserRole = "buyer" | "seller" | "admin";
type SellerStatus = "active" | "banned" | "disabled";

interface UserInfo {
  id: string;
  discordId: string;
  status?: SellerStatus; // Only for sellers
}

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  roles: UserRole[]; // All roles the user has
  user: UserInfo | null;
  sellerId: string | null; // Seller profile ID (if user has seller role)
  buyerId: string | null; // Buyer profile ID (if user has buyer role)
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  refreshAuth: () => Promise<void>;
  setAuthState: (authenticated: boolean, role: UserRole | null, user: UserInfo | null, roles?: UserRole[]) => void;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<boolean>;
  hasRole: (role: UserRole) => boolean;
  // Legacy compatibility
  seller: UserInfo | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthStateInternal] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    roles: [],
    user: null,
    sellerId: null,
    buyerId: null,
    isLoading: true,
  });

  // Fetch auth state from server
  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth", {
        credentials: "include",
      });
      const data = await response.json();

      setAuthStateInternal({
        isAuthenticated: data.authenticated || false,
        role: data.role || null,
        roles: data.roles || [],
        user: data.user || null,
        sellerId: data.sellerId || null,
        buyerId: data.buyerId || null,
        isLoading: false,
      });
    } catch (error) {
      console.error("Auth refresh error:", error);
      setAuthStateInternal({
        isAuthenticated: false,
        role: null,
        roles: [],
        user: null,
        sellerId: null,
        buyerId: null,
        isLoading: false,
      });
    }
  }, []);

  // Set auth state directly (for immediate updates after login/logout)
  const setAuthState = useCallback((
    authenticated: boolean,
    role: UserRole | null,
    user: UserInfo | null,
    roles?: UserRole[]
  ) => {
    setAuthStateInternal(prev => ({
      ...prev,
      isAuthenticated: authenticated,
      role,
      roles: roles || prev.roles,
      user,
      isLoading: false,
    }));
  }, []);

  // Switch active role
  const switchRole = useCallback(async (newRole: UserRole): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error("Role switch failed:", data.error);
        return false;
      }

      // Update local state with new active role
      setAuthStateInternal(prev => ({
        ...prev,
        role: data.role || newRole,
        roles: data.roles || prev.roles,
        user: data.user || prev.user,
      }));

      return true;
    } catch (error) {
      console.error("Role switch error:", error);
      return false;
    }
  }, []);

  // Check if user has a specific role
  const hasRole = useCallback((role: UserRole): boolean => {
    return authState.roles.includes(role);
  }, [authState.roles]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth", {
        method: "DELETE",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setAuthStateInternal({
      isAuthenticated: false,
      role: null,
      roles: [],
      user: null,
      sellerId: null,
      buyerId: null,
      isLoading: false,
    });
  }, []);

  // Check auth on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Legacy compatibility: seller is user if role is seller
  const seller = authState.role === "seller" ? authState.user : null;

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        refreshAuth,
        setAuthState,
        logout,
        switchRole,
        hasRole,
        seller,
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
