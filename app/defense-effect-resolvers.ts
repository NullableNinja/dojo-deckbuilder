import {
  applyRuntimeCommands,
  conditionValue,
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

export type DefenseRuntimeContext = {
  [key: string]: unknown;
  hasTempo?: boolean;
  weaponAttack?: boolean;
  defenderAttackedThisRound?: boolean;
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
  selectedEquipmentSubtype?: string;
};

export const DEFENSE_RESOLVERS = new Set([
  "defense.discardChoice",
  "defense.conditionalGuard",
  "defense.beltExam",
  "defense.equipmentChoice",
  "defense.delayedZoneChoice",
  "defense.failedBlockDamagePrevention",
  "defense.delayedAttackModifier",
  "defense.optionalDiscardDraw",
  "defense.playRestriction",
  "defense.forceNextAttackZone",
  "defense.beltExamCycle",
  "defense.targetNextAttackModifier",
  "defense.conditionalFocus",
  "defense.blockChoice",
  "defense.nextRoundSpeedModifier",
  "defense.blockBranch",
  "defense.nextInitiateFocus",
  "defense.deckLookChoice",
  "defense.nextPurchaseDiscount",
  "defense.equipmentChoiceFollowup",
  "defense.armorDefenseBonus",
  "defense.blockCounterDamage",
  "defense.stepBackCycle",
  "defense.nextTurnPurchaseDiscount",
  "defense.nextKataFocus",
  "defense.reversalBonus",
  "defense.alternateDefenseZone",
  "defense.reversalTargetProtection",
]);

export function isSupportedDefenseResolver(resolver?: string) {
  return Boolean(resolver && DEFENSE_RESOLVERS.has(resolver));
}

function normalizedTags(context: DefenseRuntimeContext) {
  return (context.incomingTags ?? []).map((tag) => tag.toLocaleLowerCase());
}

function isKick(context: DefenseRuntimeContext) {
  return normalizedTags(context).some((tag) => tag.includes("kick"));
}

function isGrapple(context: DefenseRuntimeContext) {
  return normalizedTags(context).some((tag) => tag.includes("grapple"));
}

function baseConditionValues(context: DefenseRuntimeContext) {
  const tags = context.incomingTags ?? [];
  const incomingZone = String(context.incomingZone ?? "");
  const defensesPlayed = context.defensesPlayedThisRound ?? 0;
  return {
    ...context,
    hasTempo: Boolean(context.hasTempo),
    weaponAttack: Boolean(context.weaponAttack),
    defenderAttackedThisRound: Boolean(context.defenderAttackedThisRound),
    targetPermanentEquipmentCount: context.targetPermanentEquipmentCount ?? 0,
    incomingAttackPower: context.incomingAttackPower ?? 0,
    incomingDamage: context.incomingDamage ?? 0,
    incomingAttackZone: incomingZone,
    incomingZone,
    incomingAttackTags: tags,
    incomingTags: tags,
    incomingAttackHasTag: tags,
    usedConsumableThisRound: Boolean(context.usedConsumableThisRound),
    defensesPlayedThisRound: defensesPlayed,
    firstDefenseThisRound: defensesPlayed === 0,
    attacksReceivedThisRound: context.attacksReceivedThisRound ?? 0,
    wasHitThisRound: Boolean(context.wasHitThisRound),
    blockSucceeded: context.blockSucceeded,
    completesActiveBeltExam: Boolean(context.completesActiveBeltExam),
    isFastest: Boolean(context.isFastest),
    targetHasMatchingArmor: Boolean(context.targetHasMatchingArmor),
    selectedEquipmentSubtype: context.selectedEquipmentSubtype ?? "",
  };
}

function resolverConditionMatches(effect: StructuredRuntimeEffect, context: DefenseRuntimeContext) {
  if (!conditionsMatch(effect, baseConditionValues(context))) return false;
  const resolver = effect.resolver;
  if (!resolver) return true;

  switch (resolver) {
    case "defense.conditionalGuard": {
      switch (effect.id) {
        case "defense-after-hours-attack-round-guard": return Boolean(context.defenderAttackedThisRound);
        case "defense-clipboard-cover-weapon-guard":
        case "defense-long-guard-weapon-guard": return Boolean(context.weaponAttack);
        case "defense-double-forearm-threshold-guard": return (context.incomingAttackPower ?? 0) >= 8;
        case "defense-inspection-head-tilt-power-guard": return (context.incomingAttackPower ?? 0) >= 5;
        case "defense-lunch-tray-consumable-guard": return Boolean(context.usedConsumableThisRound);
        case "defense-hands-up-first-defense-guard": return (context.defensesPlayedThisRound ?? 0) === 0;
        case "defense-sprawl-low-grapple-guard": return String(context.incomingZone ?? "").toLocaleLowerCase() === "low" || isGrapple(context);
        case "defense-technical-stand-up-hit-round-guard": return Boolean(context.wasHitThisRound);
        case "defense-witness-only-defense-guard": return (context.defensesPlayedThisRound ?? 0) === 0;
        default: return true;
      }
    }
    case "defense.failedBlockDamagePrevention":
      if (context.blockSucceeded !== false) return false;
      return effect.id !== "defense-not-face-small-hit-prevent" || (context.incomingDamage ?? Number.POSITIVE_INFINITY) <= 2;
    case "defense.conditionalFocus":
      return context.blockSucceeded === true && (context.attacksReceivedThisRound ?? 1) <= 1;
    case "defense.blockCounterDamage":
      return context.blockSucceeded === true && isKick(context);
    case "defense.blockBranch":
      return conditionsMatch(effect, { ...baseConditionValues(context), isFastest: Boolean(context.isFastest) });
    case "defense.armorDefenseBonus":
      return Boolean(context.targetHasMatchingArmor);
    case "defense.beltExamCycle":
      return Boolean(context.completesActiveBeltExam);
    case "defense.equipmentChoiceFollowup":
      return String(context.selectedEquipmentSubtype ?? "").toLocaleLowerCase() === "gear";
    default:
      return true;
  }
}

function choicePayload(effect: StructuredRuntimeEffect) {
  const payload: Record<string, unknown> = {};
  for (const condition of effect.conditions ?? []) {
    if (condition.kind) payload[condition.kind] = condition.value;
  }
  return payload;
}

function qualifyDefenseCommand(effect: StructuredRuntimeEffect): RuntimeCommand {
  const command = runtimeCommand(effect);
  const resolver = effect.resolver;
  if (!resolver) return command;

  if (effect.effect === "core.choice" || [
    "defense.discardChoice",
    "defense.equipmentChoice",
    "defense.optionalDiscardDraw",
    "defense.forceNextAttackZone",
    "defense.blockChoice",
    "defense.deckLookChoice",
    "defense.stepBackCycle",
  ].includes(resolver)) {
    command.choice = choicePayload(effect);
  }

  switch (resolver) {
    case "defense.delayedAttackModifier":
      command.duration = "nextAttack";
      if (effect.id === "defense-catch-sweep-next-low-counter") command.qualifier = { nextAttackZone: "Low", opponent: true };
      else if (effect.id === "defense-pak-sao-hand-counter") command.qualifier = { nextAttackTag: "Hand", opponent: true };
      else command.qualifier = { nextAttack: true, opponent: true };
      break;
    case "defense.targetNextAttackModifier":
      command.duration = "nextAttack";
      command.qualifier = effect.id === "defense-jam-kick-next-kick-penalty" ? { nextAttackTag: "Kick" } : { nextAttack: true };
      break;
    case "defense.nextRoundSpeedModifier":
      command.duration = "nextRound";
      command.qualifier = { activateAt: "nextHonor", expires: "followingHonor" };
      break;
    case "defense.nextInitiateFocus":
      command.duration = "nextInitiate";
      break;
    case "defense.nextPurchaseDiscount":
      command.duration = "nextPurchase";
      break;
    case "defense.nextTurnPurchaseDiscount":
      command.duration = "nextTurn";
      break;
    case "defense.nextKataFocus":
      command.duration = "nextKata";
      break;
    case "defense.reversalBonus":
      command.duration = "nextAttack";
      command.qualifier = { nextReversal: true, opponent: true };
      break;
    case "defense.alternateDefenseZone":
      command.qualifier = { alternateZone: conditionValue(effect, "alternateZone") ?? "Mid" };
      break;
    case "defense.reversalTargetProtection":
      command.duration = "nextTurn";
      break;
    case "defense.playRestriction":
      command.duration = "endOfTurn";
      command.qualifier = { restriction: effect.id === "defense-cross-block-defense-lock" ? "defense" : "attack" };
      break;
    case "defense.beltExam":
      command.qualifier = { beltExamTask: "attack-and-defend" };
      break;
  }
  return command;
}

export function defenseRuntimeCommands(card: RuntimeCardLike, trigger: RuntimeTrigger, context: DefenseRuntimeContext = {}) {
  const catalogId = String(card.catalogId ?? "");
  if (!catalogId.startsWith("DDB-DEF-CORE-")) return [];
  const commands: RuntimeCommand[] = [];
  for (const effect of structuredRuntimeEffects(card)) {
    if (effect.trigger !== trigger) continue;
    if (effect.resolver && !isSupportedDefenseResolver(effect.resolver)) continue;
    if (!resolverConditionMatches(effect, context)) continue;
    commands.push(qualifyDefenseCommand(effect));
  }
  return commands;
}

export function applyDefenseRuntime(state: FamilyRuntimeState, card: RuntimeCardLike, trigger: RuntimeTrigger, context: DefenseRuntimeContext = {}) {
  return applyRuntimeCommands(state, defenseRuntimeCommands(card, trigger, context));
}

export function classifyDefenseEffect(effect: StructuredRuntimeEffect) {
  if (isGenericExecutableEffect(effect)) return "generic" as const;
  if (isSupportedDefenseResolver(effect.resolver)) return "dedicated" as const;
  return "unsupported" as const;
}

export function structuredDefenseGuardBonus(defense: RuntimeCardLike, context: DefenseRuntimeContext) {
  const commands = defenseRuntimeCommands(defense, "onDefenseDeclared", context)
    .filter((command) => command.effect === "combat.modifyGuard");
  return {
    amount: commands.reduce((total, command) => total + command.amount, 0),
    notes: commands.map((command) => `${command.sourceEffectId} ${command.amount >= 0 ? "+" : ""}${command.amount} Guard`),
  };
}

export function structuredDefenseDamagePrevention(defense: RuntimeCardLike, context: DefenseRuntimeContext) {
  return ["onDefenseDeclared", "afterResolve"]
    .flatMap((trigger) => defenseRuntimeCommands(defense, trigger as RuntimeTrigger, context))
    .filter((command) => command.effect === "combat.preventDamage")
    .reduce((total, command) => total + Math.max(0, command.amount), 0);
}

export function structuredDefenseBlockDamage(defense: RuntimeCardLike, context: DefenseRuntimeContext) {
  return defenseRuntimeCommands(defense, "onBlock", context)
    .filter((command) => command.effect === "combat.dealDamage" && command.target === "opponent")
    .reduce((total, command) => total + Math.max(0, command.amount), 0);
}

export function structuredDefenseNextAttackModifier(defense: RuntimeCardLike, context: DefenseRuntimeContext) {
  return ["onBlock", "afterResolve"]
    .flatMap((trigger) => defenseRuntimeCommands(defense, trigger as RuntimeTrigger, context))
    .filter((command) => command.effect === "combat.modifyAttackPower" && command.duration === "nextAttack")
    .map((command) => ({ amount: command.amount, target: command.target, duration: command.duration, qualifier: command.qualifier }));
}
