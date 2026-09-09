import { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers.ts";
import { canPlayCoreConsumableInPhase } from "./stage3c-consumable-play-window.ts";
import type { RuntimeCardLike } from "./family-effect-runtime.ts";

export type AiReactionCard = RuntimeCardLike & {
  id: string;
  timing?: string | null;
};

export type AiDefensiveConsumableContext = ConsumableRuntimeContext & {
  missingHp?: number;
  expectedIncomingDamage?: number;
};

export function aiDefensiveConsumableScore(card: AiReactionCard, context: AiDefensiveConsumableContext = {}) {
  if (!canPlayCoreConsumableInPhase(card, "defense-window", context)) return Number.NEGATIVE_INFINITY;
  const commands = consumableRuntimeCommands(card, "onPlay", {
    ...context,
    friendlyTargetCount: context.friendlyTargetCount ?? 1,
    opponentTargetCount: context.opponentTargetCount ?? 1,
  });
  const prevention = commands
    .filter((command) => command.effect === "combat.preventDamage")
    .reduce((total, command) => total + Math.max(0, command.amount), 0);
  const defense = commands
    .filter((command) => command.effect === "combat.modifyDefense")
    .reduce((total, command) => total + Math.max(0, command.amount), 0);
  const healingAvailable = commands
    .filter((command) => command.effect === "core.heal" && !command.choice)
    .reduce((total, command) => total + Math.max(0, command.amount), 0);
  const healing = Math.min(Math.max(0, Number(context.missingHp ?? 0)), healingAvailable);
  const attackLock = commands.some((command) => command.qualifier?.restriction === "attack") ? 1 : 0;
  const invalidatesTarget = commands.some((command) => command.qualifier?.untargetable === true);
  const expectedDamage = Math.max(0, Number(context.expectedIncomingDamage ?? 0));
  const usefulPrevention = expectedDamage ? Math.min(prevention, expectedDamage) : prevention;
  const targetInvalidationValue = invalidatesTarget ? 48 + Math.min(20, expectedDamage * 4) : 0;
  return targetInvalidationValue + usefulPrevention * 8 + defense * 6 + healing * 3 - attackLock * 2;
}

export function chooseAiDefensiveConsumable(cards: AiReactionCard[], context: AiDefensiveConsumableContext = {}) {
  return [...cards]
    .map((card) => ({ card, score: aiDefensiveConsumableScore(card, context) }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((left, right) => right.score - left.score || String(left.card.catalogId ?? left.card.id).localeCompare(String(right.card.catalogId ?? right.card.id)))[0]?.card ?? null;
}
