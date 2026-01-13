import { notFound } from "next/navigation";
import { getBlueprintBySlug, getAllBlueprintSlugs } from "@/lib/blueprints";
import BlueprintDetail from "@/components/BlueprintDetail";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllBlueprintSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const blueprint = getBlueprintBySlug(slug);

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
  const blueprint = getBlueprintBySlug(slug);

  if (!blueprint) {
    notFound();
  }

  return <BlueprintDetail blueprint={blueprint} />;
}
