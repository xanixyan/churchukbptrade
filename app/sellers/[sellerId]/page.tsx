"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ItemPrice, formatItemPrice, BlueprintType } from "@/lib/types";

// Types for the API response
interface InventoryItem {
  blueprintId: string;
  blueprintName: string;
  blueprintSlug: string;
  blueprintImage: string;
  blueprintType: BlueprintType;
  quantity: number;
  price: ItemPrice;
}

interface SellerProfileData {
  seller: {
    id: string;
    discordId: string;
    status: string;
    createdAt: string;
  };
  inventory: InventoryItem[];
  stats: {
    totalOrders: number;
    completedOrders: number;
  };
}

export default function SellerProfilePage() {
  const params = useParams();
  const sellerId = params.sellerId as string;

  const [data, setData] = useState<SellerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sellerId) return;

    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}`);
        const json = await response.json();

        if (!response.ok) {
          setError(json.error || "Помилка завантаження");
          return;
        }

        setData(json);
      } catch (err) {
        console.error("Failed to fetch seller profile:", err);
        setError("Помилка мережі");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [sellerId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-dark-700 rounded mb-4"></div>
            <div className="h-24 bg-dark-800 rounded-lg mb-6"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-dark-800 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-dark-800 rounded-lg p-8 text-center">
            <div className="text-red-400 text-xl mb-4">{error}</div>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-dark-700 text-white rounded hover:bg-dark-600 transition-colors"
            >
              На головну
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div className="min-h-screen bg-dark-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-dark-800 rounded-lg p-8 text-center">
            <div className="text-gray-400 text-xl mb-4">Продавця не знайдено</div>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-dark-700 text-white rounded hover:bg-dark-600 transition-colors"
            >
              На головну
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { seller, inventory, stats } = data;

  return (
    <div className="min-h-screen bg-dark-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Назад</span>
        </Link>

        {/* Seller info card */}
        <div className="bg-dark-800 rounded-lg p-6 mb-8 border border-dark-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Seller discord */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>{seller.discordId}</span>
              </h1>
              <p className="text-gray-500 text-sm mt-1 break-all">
                ID: {seller.id}
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-neon-cyan">{stats.completedOrders}</div>
                <div className="text-sm text-gray-400">Завершені</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-300">{stats.totalOrders}</div>
                <div className="text-sm text-gray-400">Всього</div>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory section */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">
            Креслення в наявності ({inventory.length})
          </h2>

          {inventory.length === 0 ? (
            <div className="bg-dark-800 rounded-lg p-8 text-center">
              <div className="text-gray-400">
                Продавець наразі не має креслень в наявності
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {inventory.map((item) => (
                <Link
                  key={item.blueprintId}
                  href={`/bp/${item.blueprintSlug}/`}
                  className="block"
                >
                  <div className="gamer-card bg-dark-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-neon-cyan/50 transition-all">
                    {/* Image */}
                    <div
                      className="aspect-square bg-dark-700 bg-cover bg-center relative"
                      style={{
                        backgroundImage: item.blueprintImage
                          ? `url(${item.blueprintImage})`
                          : undefined,
                      }}
                    >
                      {!item.blueprintImage && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Quantity badge */}
                      <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded border bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40">
                        x{item.quantity}
                      </div>

                      {/* Type badge */}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 text-xs bg-dark-900/80 text-gray-300 rounded">
                        {item.blueprintType}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-xs text-gray-500 font-mono mb-1">{item.blueprintId}</p>
                      <h3 className="text-sm font-medium text-white truncate">{item.blueprintName}</h3>
                      <p className="text-xs text-neon-purple mt-1 truncate">
                        {formatItemPrice(item.price)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
