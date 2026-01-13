import { BlueprintSelection } from "./types";

/**
 * Builds the Discord message for purchasing blueprints.
 * Centralized function used by both single and multi-select flows.
 *
 * MESSAGE TEMPLATE:
 * ─────────────────────────────────────────────────────────
 * Привіт! Хочу купити креслення:
 * - {name} ({id}) ×{quantity}
 * - {name} ({id}) ×{quantity}
 * ...
 *
 * Мій нік в ARC Raiders: ______
 * Що пропоную взамін: ______
 * Зручно списатись/передача: ______
 * ─────────────────────────────────────────────────────────
 */
export function buildPurchaseMessage(selections: BlueprintSelection[]): string {
  if (selections.length === 0) return "";

  // Build list with quantities
  const blueprintList = selections
    .map((s) => `- ${s.blueprint.name} (${s.blueprint.id}) ×${s.quantity}`)
    .join("\n");

  return `Привіт! Хочу купити креслення:
${blueprintList}

Мій нік в ARC Raiders: ______
Що пропоную взамін: ______
Зручно списатись/передача: ______`;
}

/**
 * Calculate total item count across all selections
 */
export function getTotalItemCount(selections: BlueprintSelection[]): number {
  return selections.reduce((sum, s) => sum + s.quantity, 0);
}
