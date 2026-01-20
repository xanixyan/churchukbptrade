"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerRegister() {
  const router = useRouter();
  const [discordId, setDiscordId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    // Client-side validation
    if (password !== confirmPassword) {
      setError("Паролі не співпадають");
      setIsSubmitting(false);
      return;
    }

    if (password.length < 8) {
      setError("Пароль має містити щонайменше 8 символів");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/seller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId, password, confirmPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Помилка реєстрації");
      }
    } catch {
      setError("Помилка з'єднання. Спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success message
  if (success) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-dark-800 rounded-lg p-6 border border-green-500/30">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Реєстрація успішна</h1>
              <p className="text-sm text-gray-400 mb-6">
                Ваш обліковий запис створено та очікує підтвердження адміністратором.
                Ви зможете увійти після активації вашого облікового запису.
              </p>
              <button
                onClick={() => router.push("/seller")}
                className="w-full py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors"
              >
                Перейти до входу
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-600">
          <h1 className="text-xl font-bold text-white mb-2 text-center">Реєстрація продавця</h1>
          <p className="text-sm text-gray-400 mb-6 text-center">
            Створіть обліковий запис, щоб стати продавцем. Ваш обліковий запис буде перевірено адміністратором перед активацією.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="discordId" className="block text-sm text-gray-400 mb-2">
                Discord ID
              </label>
              <input
                id="discordId"
                type="text"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-neon-cyan/50 focus:outline-none"
                placeholder="Ваш Discord username або ID"
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Це буде використано для зв'язку з вами щодо замовлень
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-neon-cyan/50 focus:outline-none"
                placeholder="Створіть пароль"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">
                Мінімум 8 символів
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="confirmPassword" className="block text-sm text-gray-400 mb-2">
                Підтвердіть пароль
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-neon-cyan/50 focus:outline-none"
                placeholder="Підтвердіть ваш пароль"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !discordId.trim() || !password || !confirmPassword}
              className="w-full py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Створення облікового запису..." : "Зареєструватися"}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-dark-600 text-center">
            <p className="text-sm text-gray-400 mb-2">
              Вже маєте обліковий запис?
            </p>
            <a
              href="/seller"
              className="text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
            >
              Увійти тут
            </a>
          </div>

          <div className="mt-4 text-center">
            <a
              href="/"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Повернутися до каталогу
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
