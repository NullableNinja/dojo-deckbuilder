import * as legacy from "./effect-resolvers-legacy.ts";
import {
  structuredDefenseGuardBonus,
  defenseRuntimeCommands,
} from "./defense-effect-resolvers.ts";
import {
  consumableRuntimeCommands,
  structuredConsumableDestroyJunkCount,
  structuredConsumableDestroysAfterUse,
  structuredConsumableMandatoryDiscard,
  structuredConsumableNextAttackPenalty,
  structuredConsumableNextDefensePenalty,
  structuredConsumableSpeedPenalty,
} from "./consumable-effect-resolvers.ts";
import { conditionValue, structuredRuntimeEffects } from "./family-effect-runtime.ts";

export * from "./effect-resolvers-legacy.ts";

function catalogId(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return String(card.catalogId ?? "");
}

function isCoreDefense(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return catalogId(card).startsWith("DDB-DEF-CORE-");
}

function isCoreConsumable(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return catalogId(card).startsWith("DDB-CON-CORE-");
}

export function conditionalDefenseGuardBonus(
  defense: Parameters<typeof legacy.conditionalDefenseGuardBonus>[0],
  context: Parameters<typeof legacy.conditionalDefenseGuardBonus>[1] & {
    hasTempo?: boolean;
    targetPermanentEquipmentCount?: number;
    incomingAttackPower?: number;
    incomingDamage?: number;
    incomingZone?: string;
    incomingTags?: string[];
    usedConsumableThisRound?: boolean;
    defensesPlayedThisRound?: number;
    attacksReceivedThisRound?: number;
    wasHitThisRound?: boolean;
    isFastest?: boolean;
    targetHasMatchingArmor?: boolean;
    blockSucceeded?: boolean;
    completesActiveBeltExam?: boolean;
  },
) {
  if (isCoreDefense(defense)) return structuredDefenseGuardBonus(defense, context);
  return legacy.conditionalDefenseGuardBonus(defense, context);
}

export function destroysAfterUse(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableDestroysAfterUse(card);
  return legacy.destroysAfterUse(card);
}

export function destroyJunkChoiceCount(card: Parameters<typeof legacy.destroyJunkChoiceCount>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableDestroyJunkCount(card);
  return legacy.destroyJunkChoiceCount(card);
}

export function mandatoryDiscardChoiceCount(card: Parameters<typeof legacy.mandatoryDiscardChoiceCount>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableMandatoryDiscard(card);
  return legacy.mandatoryDiscardChoiceCount(card);
}

export function targetNextAttackPenalty(card: Parameters<typeof legacy.targetNextAttackPenalty>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableNextAttackPenalty(card);
  return legacy.targetNextAttackPenalty(card);
}

export function targetNextDefensePenalty(card: Parameters<typeof legacy.targetNextDefensePenalty>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableNextDefensePenalty(card);
  return legacy.targetNextDefensePenalty(card);
}

export function targetSpeedPenaltyUntilHonor(
  card: Parameters<typeof legacy.targetSpeedPenaltyUntilHonor>[0],
  context: Parameters<typeof legacy.targetSpeedPenaltyUntilHonor>[1] = {},
) {
  if (isCoreConsumable(card)) return structuredConsumableSpeedPenalty(card);
  return legacy.targetSpeedPenaltyUntilHonor(card, context);
}

export function structuredNextAttackFlow(
  card: Parameters<typeof legacy.structuredNextAttackFlow>[0],
  context: Parameters<typeof legacy.structuredNextAttackFlow>[1],
) {
  if (isCoreConsumable(card)) {
    const grant = consumableRuntimeCommands(card, context.timing)
      .some((command) => command.effect === "combat.grantFlow" && command.duration === "nextAttack");
    return { handled: structuredRuntimeEffects(card).some((effect) => effect.resolver === "consumable.nextAttackFlowUntilEndOfTurn"), grant };
  }
  return legacy.structuredNextAttackFlow(card, context);
}

export function structuredNextAttackAnyZone(
  card: Parameters<typeof legacy.structuredNextAttackAnyZone>[0],
  context: Parameters<typeof legacy.structuredNextAttackAnyZone>[1],
) {
  if (isCoreDefense(card)) {
    const commands = defenseRuntimeCommands(card, context.timing);
    const handled = structuredRuntimeEffects(card).some((effect) => effect.resolver === "defense.delayedZoneChoice");
    return { handled, grant: commands.some((command) => command.effect === "combat.chooseZone") };
  }
  return legacy.structuredNextAttackAnyZone(card, context);
}

export function optionalDiscardDrawChoice(card: Parameters<typeof legacy.optionalDiscardDrawChoice>[0]) {
  if (isCoreDefense(card)) {
    const effect = structuredRuntimeEffects(card).find((candidate) => candidate.resolver === "defense.optionalDiscardDraw");
    if (!effect) return null;
    return {
      discard: Number(conditionValue(effect, "discardCost") ?? 0),
      draw: Number(conditionValue(effect, "draw") ?? conditionValue(effect, "drawAfterCost") ?? 0),
    };
  }
  return legacy.optionalDiscardDrawChoice(card);
}

export function deckLookPlan(card: Parameters<typeof legacy.deckLookPlan>[0]): legacy.DeckLookPlan | null {
  const id = catalogId(card);
  if (id === "DDB-CON-CORE-022") return { kind: "reorder", count: 3, distinctTypeFocus: 1 };
  return legacy.deckLookPlan(card);
}
