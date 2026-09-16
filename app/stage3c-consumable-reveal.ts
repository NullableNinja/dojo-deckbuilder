import { consumableRuntimeCommands } from "./consumable-effect-resolvers.ts";
import type { RuntimeCardLike } from "./family-effect-runtime.ts";

export type ConsumableTopRevealPlan = {
  count: number;
  resolver: string;
};

export function structuredConsumableTopRevealPlan(card: RuntimeCardLike): ConsumableTopRevealPlan | null {
  const reveal = consumableRuntimeCommands(card, "onPlay", {
    friendlyTargetCount: 1,
    opponentTargetCount: 1,
    revealedFocusValue: 0,
  }).find((command) => command.effect === "core.reveal" && command.resolver === "consumable.revealTopFocusValue");
  if (!reveal) return null;
  return { count: Math.max(1, Number(reveal.amount ?? 1)), resolver: reveal.resolver ?? "consumable.revealTopFocusValue" };
}
