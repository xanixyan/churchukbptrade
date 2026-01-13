import { getAllBlueprints } from "@/lib/blueprints";
import BlueprintGrid from "@/components/BlueprintGrid";

export default function CatalogPage() {
  const blueprints = getAllBlueprints();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Каталог креслень</h2>
        <p className="text-gray-400 text-sm">
          Переглядай креслення ARC Raiders. Натисни на будь-який елемент, щоб побачити деталі та купити.
        </p>
      </div>

      <BlueprintGrid blueprints={blueprints} />
    </div>
  );
}
