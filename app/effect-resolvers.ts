import * as legacy from "./effect-resolvers-legacy.ts";
import {
  structuredDefenseGuardBonus,
  defenseRuntimeCommands,
} from "./defense-effect-resolvers.ts";
import {
  consumableRuntimeCommands,
  structuredConsumableDestroyJunkCount,
  structuredConsumableDestroyJunkPlan,
  structuredConsumableDestroysAfterUse,
  structuredConsumableMandatoryDiscard,
  structuredConsumableNextAttackPenalty,
  structuredConsumableNextDefensePenalty,
  structuredConsumableReturnsToSupply,
  structuredConsumableSpeedPenalty,
} from "./consumable-effect-resolvers.ts";
import { conditionValue, structuredRuntimeEffects } from "./family-effect-runtime.ts";
import { structuredLocationAttackForHost } from "./location-playtest-bridge.ts";
import {
  isCoreKataCard,
  kataConditionalHealForHost,
  kataDeckLookPlanForHost,
  kataDestroyPlanForHost,
  kataDiscardFollowupForHost,
  kataFastestFocusForHost,
  kataMandatoryDiscardCountForHost,
  kataNextAttackAnyZoneForHost,
  kataNextAttackFlowForHost,
} from "./kata-playtest-bridge.ts";

export * from "./effect-resolvers-legacy.ts";

function catalogId(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return String(card.catalogId ?? "");
}

function isCoreAttack(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return catalogId(card).startsWith("DDB-ATK-CORE-");
}

function isCoreDefense(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return catalogId(card).startsWith("DDB-DEF-CORE-");
}

function isCoreConsumable(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return catalogId(card).startsWith("DDB-CON-CORE-");
}

function isCoreLocation(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return catalogId(card).startsWith("DDB-LOC-CORE-");
}

function isCoreGameplay(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return /^DDB-(?:STA|ATK|DEF|KAT|CON|CMB|LOC|CHR|DEQ|GEA|WPN)-CORE-\d+$/i.test(catalogId(card));
}

export function locationAttackRuleModifiers(
  card: Parameters<typeof legacy.locationAttackRuleModifiers>[0],
  context: Parameters<typeof legacy.locationAttackRuleModifiers>[1],
) {
  if (isCoreLocation(card)) return structuredLocationAttackForHost(card, context);
  return legacy.locationAttackRuleModifiers(card, context);
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
  if (isCoreGameplay(card)) {
    return structuredRuntimeEffects(card).some((effect) => effect.effect === "core.destroy" && effect.target === "source" && effect.trigger === "onPlay");
  }
  return legacy.destroysAfterUse(card);
}

export function returnsToSupplyAfterUse(card: Parameters<typeof legacy.destroysAfterUse>[0]) {
  return isCoreConsumable(card) && structuredConsumableReturnsToSupply(card);
}

export function destroyJunkChoiceCount(card: Parameters<typeof legacy.destroyJunkChoiceCount>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableDestroyJunkCount(card);
  if (isCoreKataCard(card)) return kataDestroyPlanForHost(card)?.count ?? 0;
  if (isCoreGameplay(card)) return 0;
  return legacy.destroyJunkChoiceCount(card);
}

export function destroyJunkChoicePlan(card: Parameters<typeof legacy.destroyJunkChoiceCount>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableDestroyJunkPlan(card);
  if (isCoreKataCard(card)) {
    const plan = kataDestroyPlanForHost(card);
    return plan ? {
      resolver: "kata.structured" as const,
      count: plan.count,
      sources: plan.sources,
      optional: plan.optional,
      // The rich Kata bridge preserves drawAfterHandDestroy separately because
      // the old PendingChoice shape cannot express a source-conditional draw.
      drawAfterSuccess: plan.sources.length === 1 && plan.sources[0] === "hand" ? plan.drawAfterHandDestroy : 0,
      drawAfterHandDestroy: plan.drawAfterHandDestroy,
    } : null;
  }
  if (isCoreGameplay(card)) return null;
  const count = legacy.destroyJunkChoiceCount(card);
  return count ? { resolver: "legacy" as const, count, sources: ["hand", "discard"] as ("hand" | "discard")[], optional: false, drawAfterSuccess: 0 } : null;
}

export function mandatoryDiscardChoiceCount(card: Parameters<typeof legacy.mandatoryDiscardChoiceCount>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableMandatoryDiscard(card);
  if (isCoreKataCard(card)) return kataMandatoryDiscardCountForHost(card);
  if (isCoreGameplay(card)) {
    return structuredRuntimeEffects(card)
      .filter((effect) => effect.trigger === "onPlay" && effect.effect === "core.discard" && (effect.target ?? "self") === "self" && !effect.resolver && !(effect.conditions?.length))
      .reduce((total, effect) => total + Math.max(0, Number(effect.amount ?? 0)), 0);
  }
  return legacy.mandatoryDiscardChoiceCount(card);
}

export function targetDiscardOnHitCount(card: Parameters<typeof legacy.targetDiscardOnHitCount>[0]) {
  if (isCoreAttack(card)) {
    return structuredRuntimeEffects(card)
      .filter((effect) => effect.trigger === "onHit" && effect.effect === "core.discard" && effect.target === "opponent")
      .reduce((total, effect) => total + Math.max(0, Number(effect.amount ?? 0)), 0);
  }
  if (isCoreGameplay(card)) return 0;
  return legacy.targetDiscardOnHitCount(card);
}

export function targetNextAttackPenalty(card: Parameters<typeof legacy.targetNextAttackPenalty>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableNextAttackPenalty(card);
  if (isCoreGameplay(card)) {
    return structuredRuntimeEffects(card)
      .filter((effect) => effect.effect === "combat.modifyAttackPower" && effect.target === "opponent" && effect.duration === "nextAttack")
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  return legacy.targetNextAttackPenalty(card);
}

export function targetNextDefensePenalty(card: Parameters<typeof legacy.targetNextDefensePenalty>[0]) {
  if (isCoreConsumable(card)) return structuredConsumableNextDefensePenalty(card);
  if (isCoreGameplay(card)) {
    return structuredRuntimeEffects(card)
      .filter((effect) => ["combat.modifyGuard", "combat.modifyDefense"].includes(String(effect.effect ?? "")) && effect.target === "opponent" && effect.duration === "nextDefense")
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  return legacy.targetNextDefensePenalty(card);
}

export function targetSpeedPenaltyUntilHonor(
  card: Parameters<typeof legacy.targetSpeedPenaltyUntilHonor>[0],
  context: Parameters<typeof legacy.targetSpeedPenaltyUntilHonor>[1] = {},
) {
  if (isCoreConsumable(card)) return structuredConsumableSpeedPenalty(card);
  if (isCoreGameplay(card)) {
    const values = { previousCardIsItem: Boolean(context.previousCardIsItem) };
    return structuredRuntimeEffects(card)
      .filter((effect) => effect.effect === "combat.modifySpeed" && effect.target === "opponent" && ["nextHonor", "endOfRound"].includes(String(effect.duration ?? "")))
      .filter((effect) => (effect.conditions ?? []).every((condition) => condition.kind !== "previousCardIsItem" || Boolean(values.previousCardIsItem) === Boolean(condition.value)))
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  return legacy.targetSpeedPenaltyUntilHonor(card, context);
}

export function conditionalHealAfterHit(
  card: Parameters<typeof legacy.conditionalHealAfterHit>[0],
  wasHitSinceLastTurn: boolean,
) {
  if (isCoreKataCard(card)) return kataConditionalHealForHost(card, { wasHitSinceLastTurn });
  // Other migrated Core families execute healing in their structured family
  // runtime. This compatibility helper must never infer healing from prose.
  if (isCoreGameplay(card)) return 0;
  return legacy.conditionalHealAfterHit(card, wasHitSinceLastTurn);
}

export function discardChoiceFollowup(
  source: Parameters<typeof legacy.discardChoiceFollowup>[0],
  discarded: Parameters<typeof legacy.discardChoiceFollowup>[1],
) {
  if (isCoreKataCard(source)) {
    return kataDiscardFollowupForHost(source, {
      discardedCardType: String(discarded.cardType ?? discarded.subtype ?? ""),
      discardedFocusValue: Number(discarded.focusValue ?? 0),
    });
  }
  if (isCoreGameplay(source)) {
    return { focus: 0, nextAttackPower: 0, nextDefenseGuard: 0, notes: [] as string[] };
  }
  return legacy.discardChoiceFollowup(source, discarded);
}

export function structuredFocusIfFastest(
  card: Parameters<typeof legacy.structuredFocusIfFastest>[0],
  selfSpeed: number,
  opponentSpeed: number,
) {
  if (isCoreKataCard(card)) return kataFastestFocusForHost(card, selfSpeed, opponentSpeed);
  return legacy.structuredFocusIfFastest(card, selfSpeed, opponentSpeed);
}

export function structuredNextAttackFlow(
  card: Parameters<typeof legacy.structuredNextAttackFlow>[0],
  context: Parameters<typeof legacy.structuredNextAttackFlow>[1],
) {
  if (isCoreKataCard(card)) return kataNextAttackFlowForHost(card, context.timing, {
    differentZoneFromPreviousAttack: context.differentZoneFromPreviousAttack,
  });
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
  if (isCoreKataCard(card)) return kataNextAttackAnyZoneForHost(card, context.timing, {
    firstAttackThisTurn: context.attackNumber === 0,
  });
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
  if (isCoreConsumable(card)) return null;
  return legacy.optionalDiscardDrawChoice(card);
}

export function deckLookPlan(card: Parameters<typeof legacy.deckLookPlan>[0]): legacy.DeckLookPlan | null {
  if (isCoreKataCard(card)) return kataDeckLookPlanForHost(card);
  if (isCoreConsumable(card)) {
    const reorder = structuredRuntimeEffects(card).find((effect) => effect.resolver === "consumable.reorderTopThree");
    if (reorder) {
      return {
        kind: "reorder",
        count: Number(conditionValue(reorder, "revealCount") ?? conditionValue(reorder, "count") ?? 3),
        distinctTypeFocus: Number(conditionValue(reorder, "bonusFocus") ?? 1),
      };
    }
    return null;
  }
  if (isCoreGameplay(card)) return null;
  return legacy.deckLookPlan(card);
}
