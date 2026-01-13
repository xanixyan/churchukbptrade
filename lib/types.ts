export interface Blueprint {
  id: string;
  name: string;
  slug: string;
  image: string;
  owned: boolean;
  notes?: string;
}

// Selection with quantity for multi-select feature
export interface BlueprintSelection {
  blueprint: Blueprint;
  quantity: number;
}
