"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type AuthMode = "login" | "register";
type UserRole = "buyer" | "seller";

// Inner component that uses useSearchParams
function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, role, setAuthState, isLoading } = useAuth();

  // Get initial mode from URL params
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const initialRole = searchParams.get("role") === "seller" ? "seller" : "buyer";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [discordId, setDiscordId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      if (role === "seller") {
        router.push("/seller");
      } else if (role === "buyer") {
        router.push("/buyer");
      } else if (role === "admin") {
        router.push("/admin");
      }
    }
  }, [isAuthenticated, role, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: mode,
          role: selectedRole,
          discordId: discordId.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if we need to redirect to seller registration
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        setError(data.error || "Помилка автентифікації");
        return;
      }

      // Success
      setAuthState(true, data.role, data.user);

      if (data.message) {
        setSuccess(data.message);
      }

      // Redirect based on role
      setTimeout(() => {
        if (data.role === "seller") {
          router.push("/seller");
        } else if (data.role === "buyer") {
          router.push("/buyer");
        }
      }, 500);
    } catch (err) {
      console.error("Auth error:", err);
      setError("Помилка підключення до сервера");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-neon-cyan transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На головну
        </Link>

        <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
          {/* Mode tabs */}
          <div className="flex border-b border-dark-600">
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                mode === "login"
                  ? "bg-dark-700 text-neon-cyan border-b-2 border-neon-cyan"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Вхід
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
                setSuccess("");
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                mode === "register"
                  ? "bg-dark-700 text-neon-cyan border-b-2 border-neon-cyan"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Реєстрація
            </button>
          </div>

          <div className="p-6">
            <h1 className="text-xl font-bold text-white mb-6 text-center">
              {mode === "login" ? "Вхід в систему" : "Реєстрація"}
            </h1>

            {/* Role selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Я...
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("buyer")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedRole === "buyer"
                      ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"
                      : "border-dark-600 text-gray-400 hover:border-dark-500"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                    <span className="font-medium">Покупець</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("seller")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedRole === "seller"
                      ? "border-neon-purple bg-neon-purple/10 text-neon-purple"
                      : "border-dark-600 text-gray-400 hover:border-dark-500"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    <span className="font-medium">Продавець</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Info message for role */}
            <div className="mb-6 p-3 rounded-lg bg-dark-700 border border-dark-600">
              {selectedRole === "buyer" ? (
                <p className="text-sm text-gray-400">
                  {mode === "register"
                    ? "Покупці реєструються миттєво. Введіть Discord нік та пароль."
                    : "Введіть ваш Discord нік та пароль для входу."}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  {mode === "register"
                    ? "Продавці проходять верифікацію. Вас буде перенаправлено на форму реєстрації продавця."
                    : "Введіть ваш Discord нік та пароль для входу."}
                </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                {success}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Discord ID */}
              <div>
                <label htmlFor="discordId" className="block text-sm font-medium text-gray-300 mb-2">
                  Discord нік
                </label>
                <input
                  type="text"
                  id="discordId"
                  value={discordId}
                  onChange={(e) => setDiscordId(e.target.value)}
                  placeholder="your_username"
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Літери, цифри, _, ., - (2–32 символи)
                </p>
              </div>

              {/* Password (required for both buyers and sellers) */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Пароль
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
                  required
                />
                {mode === "register" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Мінімум 8 символів
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold transition-colors ${
                  submitting
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : selectedRole === "buyer"
                    ? "bg-neon-cyan text-black hover:bg-neon-cyan/90"
                    : "bg-neon-purple text-white hover:bg-neon-purple/90"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Обробка...
                  </span>
                ) : mode === "login" ? (
                  "Увійти"
                ) : (
                  "Зареєструватись"
                )}
              </button>
            </form>

            {/* Mode switch prompt */}
            <p className="mt-6 text-center text-sm text-gray-400">
              {mode === "login" ? (
                <>
                  Немає облікового запису?{" "}
                  <button
                    onClick={() => {
                      setMode("register");
                      setError("");
                      setSuccess("");
                    }}
                    className="text-neon-cyan hover:underline"
                  >
                    Зареєструватись
                  </button>
                </>
              ) : (
                <>
                  Вже є обліковий запис?{" "}
                  <button
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setSuccess("");
                    }}
                    className="text-neon-cyan hover:underline"
                  >
                    Увійти
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function AuthPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-400">Завантаження...</div>
    </div>
  );
}

// Main export with Suspense boundary
export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <AuthPageContent />
    </Suspense>
  );
}
