import { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers.ts";
import type { RuntimeCardLike } from "./family-effect-runtime.ts";

export type ConsumableSurfacePhase = "player-yell" | "defense-window" | "player-ascend" | "player-initiate" | "reversal-window" | "ai-ready";

type TimedRuntimeCard = RuntimeCardLike & { timing?: string | null };

export function canPlayCoreConsumableInPhase(card: TimedRuntimeCard, phase: ConsumableSurfacePhase, context: ConsumableRuntimeContext = {}) {
  const timing = String(card.timing ?? "").trim().toLocaleLowerCase();
  if (phase === "player-yell") return timing === "turn" || timing === "anytime";
  if (phase !== "defense-window") return false;
  if (timing === "anytime") return true;
  if (timing !== "reaction") return false;

  const commands = consumableRuntimeCommands(card, "onPlay", {
    ...context,
    friendlyTargetCount: context.friendlyTargetCount ?? 1,
    opponentTargetCount: context.opponentTargetCount ?? 1,
  });
  return commands.some((command) => command.effect === "combat.preventDamage" || command.effect === "combat.modifyDefense");
}

export function stage3cRestrictionBlocks(restrictions: string[] | undefined, kind: "attack" | "consumable") {
  return Boolean(restrictions?.includes(kind));
}
