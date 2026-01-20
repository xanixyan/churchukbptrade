import { notFound } from "next/navigation";
import { getBlueprintBySlugWithInventory } from "@/lib/blueprints";
import BlueprintDetail from "@/components/BlueprintDetail";
import type { Metadata } from "next";

// Force dynamic rendering - read fresh data on every request
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // Use getBlueprintBySlugWithInventory to include seller inventory
  const blueprint = getBlueprintBySlugWithInventory(slug);

  if (!blueprint) {
    return {
      title: "Креслення не знайдено | churchukbptrade",
    };
  }

  return {
    title: `${blueprint.name} | churchukbptrade`,
    description: `Купити ${blueprint.name} (${blueprint.id}) креслення для ARC Raiders від churchuk.`,
  };
}

export default async function BlueprintPage({ params }: PageProps) {
  const { slug } = await params;
  // Use getBlueprintBySlugWithInventory to include seller inventory in availability
  const blueprint = getBlueprintBySlugWithInventory(slug);

  if (!blueprint) {
    notFound();
  }

  return <BlueprintDetail blueprint={blueprint} />;
}
