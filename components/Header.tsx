"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import ChatSection from "@/components/ChatSection";

export default function Header() {
  const { isAuthenticated, role, roles, user, isLoading, logout, switchRole, hasRole } = useAuth();
  const { totalItems, toggleCart } = useCart();
  const [isSwitching, setIsSwitching] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  // Check if user has multiple roles
  const hasMultipleRoles = roles.length > 1;

  // Fetch chat count for badge
  const fetchChatCount = useCallback(async () => {
    if (!isAuthenticated || !role || (role !== "buyer" && role !== "seller")) {
      setChatCount(0);
      return;
    }
    try {
      const res = await fetch("/api/chats", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setChatCount(data.totalUnread || 0);
      }
    } catch {
      // Silently fail — badge just won't show
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    fetchChatCount();
    // Refresh count every 30s
    const interval = setInterval(fetchChatCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchChatCount]);

  // Body scroll lock when drawer is open
  useEffect(() => {
    if (chatOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [chatOpen]);

  // Close drawer on outside click
  useEffect(() => {
    if (!chatOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (chatPanelRef.current && !chatPanelRef.current.contains(e.target as Node)) {
        setChatOpen(false);
      }
    };
    // Delay to avoid closing immediately on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [chatOpen]);

  // Close drawer on Escape
  useEffect(() => {
    if (!chatOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [chatOpen]);

  // Determine dashboard URL based on role
  const getDashboardUrl = () => {
    if (!role) return "/auth";
    switch (role) {
      case "seller": return "/seller";
      case "buyer": return "/buyer";
      case "admin": return "/admin";
      default: return "/auth";
    }
  };

  // Get role display name
  const getRoleDisplayName = () => {
    switch (role) {
      case "seller": return "Продавець";
      case "buyer": return "Покупець";
      case "admin": return "Адмін";
      default: return "";
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    window.location.href = "/auth?mode=login";
  };

  // Render navigation buttons
  const renderNav = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-20 h-8 bg-dark-700 rounded-lg animate-pulse" />
          <div className="w-24 h-8 bg-dark-700 rounded-lg animate-pulse" />
        </div>
      );
    }

    if (isAuthenticated && role) {
      const handleRoleSwitch = async () => {
        if (isSwitching) return;
        const targetRole = role === "buyer" ? "seller" : "buyer";
        setIsSwitching(true);
        try {
          const success = await switchRole(targetRole);
          if (success) {
            window.location.href = targetRole === "seller" ? "/seller" : "/buyer";
          }
        } finally {
          setIsSwitching(false);
        }
      };

      return (
        <div className="flex items-center gap-3">
          {/* User info badge with optional role switch */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-dark-700 rounded-lg border border-dark-600">
            <span className="text-xs text-gray-400">{getRoleDisplayName()}</span>
            <span className="text-sm font-medium text-white truncate max-w-[120px]">
              {user?.discordId}
            </span>
            {hasMultipleRoles && (
              <button
                onClick={handleRoleSwitch}
                disabled={isSwitching}
                className="ml-1 p-1 text-gray-400 hover:text-neon-cyan transition-colors disabled:opacity-50"
                title={`Перемкнути на ${role === "buyer" ? "Продавця" : "Покупця"}`}
              >
                <svg
                  className={`w-4 h-4 ${isSwitching ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Mobile role switch */}
          {hasMultipleRoles && (
            <button
              onClick={handleRoleSwitch}
              disabled={isSwitching}
              className="sm:hidden px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg transition-all disabled:opacity-50"
              title={`Перемкнути на ${role === "buyer" ? "Продавця" : "Покупця"}`}
            >
              {isSwitching ? "..." : role === "buyer" ? "Продавець" : "Покупець"}
            </button>
          )}

          {/* Cabinet button */}
          <Link
            href={getDashboardUrl()}
            className={`px-4 py-1.5 text-sm font-medium text-white border rounded-lg transition-all flex items-center gap-2 ${
              role === "seller"
                ? "bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 hover:from-neon-cyan/30 hover:to-neon-purple/30 border-neon-cyan/40 hover:border-neon-cyan"
                : "bg-neon-cyan/20 hover:bg-neon-cyan/30 border-neon-cyan/40 hover:border-neon-cyan"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Кабінет
          </Link>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-gray-500 rounded-lg transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Вийти</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth?mode=login"
          className="px-4 py-1.5 text-sm font-medium text-gray-300 hover:text-white bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-neon-cyan/50 rounded-lg transition-all"
        >
          Вхід
        </Link>
        <Link
          href="/auth?mode=register"
          className="px-4 py-1.5 text-sm font-medium text-neon-cyan hover:text-white bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 hover:border-neon-cyan rounded-lg transition-all"
        >
          Реєстрація
        </Link>
      </div>
    );
  };

  // Show chat icon only for buyer/seller
  const showChatIcon = isAuthenticated && (role === "buyer" || role === "seller");

  return (
    <>
      <header className="bg-dark-800 border-b border-dark-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <h1 className="text-2xl font-bold gradient-text">churchukbptrade</h1>
              <span className="px-2 py-1 text-xs font-medium bg-gamer-gradient-subtle text-neon-cyan rounded border border-neon-cyan/30">
                ARC Raiders
              </span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Chat Button */}
              {showChatIcon && (
                <button
                  onClick={() => {
                    setChatOpen(prev => !prev);
                    fetchChatCount();
                  }}
                  className="relative p-2 text-gray-400 hover:text-neon-cyan transition-colors"
                  title="Чати"
                  aria-label="Відкрити/закрити чати"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  {chatCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-bold bg-neon-cyan text-dark-900 rounded-full">
                      {chatCount > 99 ? "99+" : chatCount}
                    </span>
                  )}
                </button>
              )}

              {/* Cart Button */}
              <button
                onClick={toggleCart}
                data-cart-toggle
                className="relative p-2 text-gray-400 hover:text-neon-cyan transition-colors"
                title="Кошик"
                aria-label="Відкрити/закрити кошик"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-bold bg-neon-cyan text-dark-900 rounded-full">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>

              {/* Navigation */}
              {renderNav()}

              {/* Discord Link */}
              <a
                href="https://discord.gg/8QHke5UX"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5 text-[#5865F2]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                <span className="font-medium text-white hidden sm:inline">churchuk</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Drawer (slide-in from right) */}
      {chatOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Panel */}
          <div
            ref={chatPanelRef}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-dark-900 border-l border-dark-600 shadow-2xl flex flex-col animate-slide-in-right"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-600">
              <h2 className="text-lg font-semibold text-white">Чати</h2>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex-1 min-h-0 flex flex-col p-4">
              <ChatSection onChatCountChange={setChatCount} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
