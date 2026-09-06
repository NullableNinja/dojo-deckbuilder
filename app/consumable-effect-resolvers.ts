import {
  applyRuntimeCommands,
  conditionsMatch,
  isGenericExecutableEffect,
  runtimeCommand,
  structuredRuntimeEffects,
  type FamilyRuntimeState,
  type RuntimeCardLike,
  type RuntimeCommand,
  type RuntimeTrigger,
  type StructuredRuntimeEffect,
} from "./family-effect-runtime.ts";

export type ConsumableRuntimeContext = {
  hpThresholdMet?: boolean;
  hasTempo?: boolean;
  handEmptyAfterHeal?: boolean;
  normalAttacksResolvedThisTurn?: number;
  reactionItemUsedSinceLastTurn?: boolean;
  temporaryNegativeModifierPresent?: boolean;
  removedTemporaryNegativeModifier?: boolean;
  nextAttackBlocked?: boolean;
  interferencePrevented?: boolean;
  chosenFriendlyIsBenched?: boolean;
  chosenFriendlyIsConscious?: boolean;
  sameTurnSourceActive?: boolean;
  discardedCount?: number;
  revealedFocusValue?: number;
  revealedDifferentTypeCount?: number;
  selectedEquipmentSubtype?: string;
};

export const CONSUMABLE_RESOLVERS = new Set([
  "consumable.cancelReaction",
  "consumable.chooseOpponentNextAttackPenalty",
  "consumable.chooseFriendlyHealTarget",
  "consumable.nextQualifyingAttackModifier",
  "consumable.nextDamagePrevention",
  "consumable.nextAttackUntilEndOfTurn",
  "consumable.focusByHpThreshold",
  "consumable.chooseOpponentDiscardReactionIfAble",
  "consumable.optionalExhaustToCycle",
  "consumable.restrictedFocusItemsEquipment",
  "consumable.raffleTicket",
  "consumable.nextAttackFlowUntilEndOfTurn",
  "consumable.setSpeedToValue",
  "consumable.nextIncomingAttackDefense",
  "consumable.replaceDisarmWithSelfDestroy",
  "consumable.modifyAttackStat",
  "consumable.sameTurnDirectSelfDamage",
  "consumable.revealTopFocusValue",
  "consumable.zoneSpecificIncomingAttackPenalty",
  "consumable.reorderTopThree",
  "consumable.destroyJunkThenDrawTwo",
  "consumable.healByChosenFriendlyPosition",
  "consumable.drawIfHandEmptyAfterHeal",
  "consumable.destroyJunkFromHand",
  "consumable.ascendPurchaseDiscount",
  "consumable.removeTemporaryNegativeStatModifier",
  "consumable.pepTalkConditionalAttackBonus",
  "consumable.discardUpToForFocus",
  "consumable.replaceRevealedMarketOrLocation",
  "consumable.suppressChosenWeaponClause",
  "consumable.preventAttackUntilNextTurn",
  "consumable.blockedAttackBacklash",
  "consumable.afterSecondNormalAttackFocus",
  "consumable.tempoAtUseCycle",
  "consumable.modifyDefenseUntilNextTurn",
  "consumable.chooseOpponentNextDefenseGuardPenalty",
  "consumable.exhaustEquipmentForFocus",
  "consumable.preventInterfereOnNextAttack",
  "consumable.optionalDestroyJunkFromHand",
  "consumable.untargetableUntilTurnOrAttack",
  "consumable.healAndRemoveStatus",
  "consumable.topThreeAttackSelection",
  "consumable.nextKataFocusBonus",
  "consumable.warrantyIcePop",
  "consumable.chooseOpponentSpeedPenalty",
  "consumable.gainXp",
  "consumable.pocketYoyo",
]);

export function isSupportedConsumableResolver(resolver?: string) {
  return Boolean(resolver && CONSUMABLE_RESOLVERS.has(resolver));
}

function conditionValues(context: ConsumableRuntimeContext) {
  return {
    hasTempo: Boolean(context.hasTempo),
  };
}

function resolverConditionMatches(catalogId: string, effect: StructuredRuntimeEffect, context: ConsumableRuntimeContext) {
  if (!conditionsMatch(effect, conditionValues(context))) return false;
  switch (effect.resolver) {
    case "consumable.focusByHpThreshold": return Boolean(context.hpThresholdMet);
    case "consumable.drawIfHandEmptyAfterHeal": return Boolean(context.handEmptyAfterHeal);
    case "consumable.afterSecondNormalAttackFocus": return (context.normalAttacksResolvedThisTurn ?? 0) >= 2;
    case "consumable.tempoAtUseCycle": return Boolean(context.hasTempo);
    case "consumable.pepTalkConditionalAttackBonus": return Boolean(context.removedTemporaryNegativeModifier);
    case "consumable.sameTurnDirectSelfDamage": return context.sameTurnSourceActive !== false;
    case "consumable.blockedAttackBacklash":
      return effect.trigger !== "passive" || Boolean(context.nextAttackBlocked);
    case "consumable.preventInterfereOnNextAttack":
      return effect.trigger !== "passive" || !context.interferencePrevented;
    case "consumable.pocketYoyo":
      return effect.trigger !== "passive" || Boolean(context.nextAttackBlocked);
    case "consumable.warrantyIcePop":
      if (effect.id?.includes("bonus")) return Boolean(context.reactionItemUsedSinceLastTurn);
      return true;
    case "consumable.healByChosenFriendlyPosition":
      return !context.chosenFriendlyIsBenched || Boolean(context.chosenFriendlyIsConscious);
    default:
      return true;
  }
}

function choiceResolver(resolver?: string) {
  return new Set([
    "consumable.cancelReaction",
    "consumable.chooseOpponentNextAttackPenalty",
    "consumable.chooseFriendlyHealTarget",
    "consumable.chooseOpponentDiscardReactionIfAble",
    "consumable.optionalExhaustToCycle",
    "consumable.raffleTicket",
    "consumable.replaceDisarmWithSelfDestroy",
    "consumable.zoneSpecificIncomingAttackPenalty",
    "consumable.reorderTopThree",
    "consumable.destroyJunkThenDrawTwo",
    "consumable.healByChosenFriendlyPosition",
    "consumable.destroyJunkFromHand",
    "consumable.ascendPurchaseDiscount",
    "consumable.removeTemporaryNegativeStatModifier",
    "consumable.discardUpToForFocus",
    "consumable.replaceRevealedMarketOrLocation",
    "consumable.suppressChosenWeaponClause",
    "consumable.exhaustEquipmentForFocus",
    "consumable.optionalDestroyJunkFromHand",
    "consumable.healAndRemoveStatus",
    "consumable.topThreeAttackSelection",
    "consumable.chooseOpponentSpeedPenalty",
  ]).has(String(resolver ?? ""));
}

function qualifyConsumableCommand(catalogId: string, effect: StructuredRuntimeEffect, context: ConsumableRuntimeContext): RuntimeCommand {
  const command = runtimeCommand(effect);
  const resolver = effect.resolver;
  if (!resolver) return command;

  if (choiceResolver(resolver) && ["core.custom", "core.choice", "core.destroy", "equipment.exhaust", "core.discard", "core.reveal", "economy.modifyCost"].includes(command.effect)) {
    command.choice = { resolver, catalogId };
  }

  switch (resolver) {
    case "consumable.nextQualifyingAttackModifier":
      command.qualifier = { nextAttackTag: "Unarmed", expires: "endOfTurn" };
      command.duration = "nextAttack";
      break;
    case "consumable.nextAttackUntilEndOfTurn":
      command.qualifier = { nextAttack: true, expires: "endOfTurn" };
      command.duration = "nextAttack";
      break;
    case "consumable.nextAttackFlowUntilEndOfTurn":
      command.qualifier = { nextAttack: true, expires: "endOfTurn" };
      command.duration = "nextAttack";
      break;
    case "consumable.chooseOpponentNextAttackPenalty":
      command.qualifier = { nextAttack: true };
      command.duration = "nextAttack";
      break;
    case "consumable.nextDamagePrevention":
      command.qualifier = { nextDamageEvent: true };
      command.duration = effect.duration ?? "nextDamage";
      break;
    case "consumable.nextIncomingAttackDefense":
      command.qualifier = { nextIncomingAttack: true };
      command.duration = "nextAttack";
      break;
    case "consumable.setSpeedToValue":
      command.qualifier = { setValue: Number(effect.amount ?? 0) };
      break;
    case "consumable.modifyAttackStat":
      command.qualifier = { stat: "ATK" };
      break;
    case "consumable.modifyDefenseUntilNextTurn":
      command.qualifier = { stat: "DEF" };
      command.duration = "nextTurn";
      break;
    case "consumable.sameTurnDirectSelfDamage":
      command.qualifier = { directDamage: true };
      break;
    case "consumable.revealTopFocusValue":
      if (command.effect === "core.gainFocus") command.amount = Math.max(command.amount, Number(context.revealedFocusValue ?? command.amount));
      break;
    case "consumable.zoneSpecificIncomingAttackPenalty":
      command.qualifier = { chosenIncomingZone: true };
      command.duration = "nextAttack";
      break;
    case "consumable.reorderTopThree":
      command.choice = { resolver, reveal: 3, bonusFocusIfDifferentTypes: 3 };
      break;
    case "consumable.ascendPurchaseDiscount":
      command.qualifier = { minPrintedCost: 5, minimumFinalCost: 4 };
      break;
    case "consumable.pepTalkConditionalAttackBonus":
      command.duration = "nextAttack";
      break;
    case "consumable.discardUpToForFocus":
      command.choice = { resolver, maxDiscard: 2, focusPerDiscard: 2 };
      if (command.effect === "core.gainFocus") command.amount = Math.max(0, context.discardedCount ?? 0) * 2;
      break;
    case "consumable.preventAttackUntilNextTurn":
      command.duration = "nextTurn";
      command.qualifier = { restriction: "attack" };
      break;
    case "consumable.blockedAttackBacklash":
      if (command.trigger === "passive") command.effect = "combat.dealDamage";
      command.qualifier = { watchedAttack: "nextAttack" };
      break;
    case "consumable.preventInterfereOnNextAttack":
      command.duration = "nextAttack";
      command.qualifier = { prevent: "interfere" };
      break;
    case "consumable.untargetableUntilTurnOrAttack":
      command.duration = "nextTurn";
      command.qualifier = { expiresOnAttack: true, untargetable: true };
      break;
    case "consumable.nextKataFocusBonus":
      command.duration = "nextKata";
      command.qualifier = { nextKata: true };
      break;
    case "consumable.warrantyIcePop":
      if (command.effect === "core.custom") {
        command.duration = "endOfTurn";
        command.qualifier = { restriction: "consumable" };
      }
      break;
    case "consumable.pocketYoyo":
      if (command.trigger === "passive") command.qualifier = { afterPenalizedDefenseBlocks: true };
      break;
    case "consumable.restrictedFocusItemsEquipment":
      command.duration = "endOfTurn";
      command.qualifier = { spendOnlyOn: ["Item", "Equipment"] };
      break;
    case "consumable.suppressChosenWeaponClause":
      command.duration = "endOfTurn";
      command.qualifier = { suppress: ["drawback", "exhaustion", "self-penalty"] };
      break;
  }
  return command;
}

export function consumableRuntimeCommands(card: RuntimeCardLike, trigger: RuntimeTrigger, context: ConsumableRuntimeContext = {}) {
  const catalogId = String(card.catalogId ?? "");
  if (!catalogId.startsWith("DDB-CON-CORE-")) return [];
  const commands: RuntimeCommand[] = [];
  for (const effect of structuredRuntimeEffects(card)) {
    if (effect.trigger !== trigger) continue;
    if (effect.resolver && !isSupportedConsumableResolver(effect.resolver)) continue;
    if (!resolverConditionMatches(catalogId, effect, context)) continue;
    commands.push(qualifyConsumableCommand(catalogId, effect, context));
  }
  return commands;
}

export function applyConsumableRuntime(state: FamilyRuntimeState, card: RuntimeCardLike, trigger: RuntimeTrigger, context: ConsumableRuntimeContext = {}) {
  return applyRuntimeCommands(state, consumableRuntimeCommands(card, trigger, context));
}

export function classifyConsumableEffect(effect: StructuredRuntimeEffect) {
  if (isGenericExecutableEffect(effect)) return "generic" as const;
  if (isSupportedConsumableResolver(effect.resolver)) return "dedicated" as const;
  return "unsupported" as const;
}

export function structuredConsumableDestroysAfterUse(card: RuntimeCardLike) {
  return consumableRuntimeCommands(card, "onPlay").some((command) => command.effect === "core.destroy" && command.target === "source");
}

export function structuredConsumableNextAttackPenalty(card: RuntimeCardLike) {
  return consumableRuntimeCommands(card, "onPlay")
    .filter((command) => command.effect === "combat.modifyAttackPower" && command.target === "opponent")
    .reduce((total, command) => total + Math.abs(command.amount), 0);
}

export function structuredConsumableNextDefensePenalty(card: RuntimeCardLike) {
  return consumableRuntimeCommands(card, "onPlay")
    .filter((command) => command.effect === "combat.modifyGuard" && command.target === "opponent" && command.duration === "nextDefense")
    .reduce((total, command) => total + Math.abs(command.amount), 0);
}

export function structuredConsumableSpeedPenalty(card: RuntimeCardLike) {
  return consumableRuntimeCommands(card, "onPlay")
    .filter((command) => command.effect === "combat.modifySpeed" && command.target === "opponent")
    .reduce((total, command) => total + Math.abs(command.amount), 0);
}

export function structuredConsumableDestroyJunkCount(card: RuntimeCardLike) {
  return consumableRuntimeCommands(card, "onPlay")
    .filter((command) => command.effect === "core.destroy" && command.target === "chosen-card")
    .reduce((total, command) => total + Math.max(1, command.amount), 0);
}

export function structuredConsumableMandatoryDiscard(card: RuntimeCardLike) {
  return consumableRuntimeCommands(card, "onPlay")
    .filter((command) => command.effect === "core.discard" && command.target === "self" && !command.choice)
    .reduce((total, command) => total + Math.max(0, command.amount), 0);
}
