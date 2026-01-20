import { getAllBlueprintsWithInventory, getLastUpdatedTime } from "@/lib/blueprints";
import BlueprintGrid from "@/components/BlueprintGrid";

// Force dynamic rendering - read fresh data on every request
export const dynamic = "force-dynamic";

export default function CatalogPage() {
  // Use getAllBlueprintsWithInventory to include seller inventory in availability calculation
  const blueprints = getAllBlueprintsWithInventory();
  const lastUpdated = getLastUpdatedTime();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Каталог креслень</h2>
            <p className="text-gray-400 text-sm">
              Переглядай креслення ARC Raiders. Натисни на будь-який елемент, щоб побачити деталі та купити.
            </p>
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              Оновлено: {new Date(lastUpdated).toLocaleString("uk-UA")}
            </div>
          )}
        </div>
      </div>

      <BlueprintGrid blueprints={blueprints} />
    </div>
  );
}
