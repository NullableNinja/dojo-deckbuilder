import comboRequirementsJson from "./data/combo-requirements.json" with { type: "json" };
import cardEffectsJson from "./data/card-effects.json" with { type: "json" };
import { runtimeCommand, type RuntimeCommand, type RuntimeTrigger, type StructuredRuntimeEffect } from "./family-effect-runtime.ts";

export type ComboRuntimeCard = {
  id: string;
  name: string;
  catalogId?: string | null;
  cardType?: string;
  subtype?: string;
  zone?: string | null;
  tags?: string[];
};

export type ComboRequirementStep = {
  family?: "Attack" | "Defense" | "Kata" | string;
  tags?: string[];
  zone?: string;
};

export type ComboRequirement = {
  kind: string;
  steps?: ComboRequirementStep[];
  zones?: string[];
  sameOpponent?: boolean;
  window?: "turn" | "round" | string;
  tag?: string;
  amount?: number;
  minimumPriorCombos?: number;
  family?: string;
  ordinal?: number;
  minimumPriorAttacks?: number;
};

export type ComboRequirementEntry = {
  name?: string;
  displayText?: string;
  requirements?: ComboRequirement[];
};

type ComboRequirementRegistry = {
  cards?: Record<string, ComboRequirementEntry>;
};

type ComboEffectRegistry = {
  cards?: Record<string, { name?: string; effects?: StructuredRuntimeEffect[] }>;
};

export type ComboRuntimeContext = {
  priorCards: ComboRuntimeCard[];
  attacksThisTurn: number;
  defendedThisRound: boolean;
  blockedThisRound?: boolean;
  hitThisTurn: boolean;
  hitZonesThisTurn?: string[];
  zonesPlayed: string[];
  equipment: ComboRuntimeCard[];
  currentCard: ComboRuntimeCard;
  currentZone: string;
  isReversal?: boolean;
  currentAttackHit?: boolean;
  currentDefense?: ComboRuntimeCard | null;
  currentDefenseBlocked?: boolean;
  completedBeltExamThisRound?: boolean;
  triggeredComboIds?: string[];
};

export type ComboRequirementResult = {
  eligible: boolean;
  supported: boolean;
  reason: string;
};

export type ComboAttackEvaluation = ComboRequirementResult & {
  power: number;
  damage: number;
  focusOnHit: number;
  grantsFlow: boolean;
  speedOnTrigger: number;
  piercing: number;
  choiceRequired: boolean;
};

export type ComboRuntimeChoice = {
  kind: "chooseCard";
  sourceEffectId: string;
  resolver: string;
  prompt: string;
  source: "hand";
  filter: { tag?: string; family?: string };
  action: "discard";
  optional: boolean;
  followupEffectIds: string[];
};

const requirementRegistry = comboRequirementsJson as unknown as ComboRequirementRegistry;
const effectRegistry = cardEffectsJson as unknown as ComboEffectRegistry;

export const SUPPORTED_COMBO_RESOLVERS = new Set([
  "combo.requirement",
  "combo.grantFlow",
  "combo.gainXP",
  "combo.drawThenDiscard",
  "combo.nextRoundSpeed",
  "combo.equipmentDefenseSuppression",
  "combo.nextReactionPenalty",
  "combo.delayedNextInitiate",
  "combo.delayedNextTurnAttack",
  "combo.discardWeaponChoice",
]);

const catalogIdOf = (card: ComboRuntimeCard | string) => typeof card === "string" ? card : String(card.catalogId ?? "").trim();
const lower = (value: unknown) => String(value ?? "").toLocaleLowerCase();
const cardTags = (card: ComboRuntimeCard | null | undefined) => (card?.tags ?? []).map(lower);
const hasTag = (card: ComboRuntimeCard | null | undefined, tag: string) => cardTags(card).some((entry) => entry === lower(tag) || entry.includes(lower(tag)));
const isAttack = (card: ComboRuntimeCard | null | undefined) => lower(card?.subtype) === "attack" || lower(card?.cardType) === "attack" || hasTag(card, "attack");
const isDefense = (card: ComboRuntimeCard | null | undefined) => lower(card?.subtype) === "defense" || lower(card?.cardType) === "defense" || hasTag(card, "defense") || hasTag(card, "block");
const isKata = (card: ComboRuntimeCard | null | undefined) => lower(card?.subtype) === "kata" || lower(card?.cardType) === "kata" || hasTag(card, "kata");

function familyMatches(card: ComboRuntimeCard, family?: string) {
  if (!family) return true;
  if (lower(family) === "attack") return isAttack(card);
  if (lower(family) === "defense") return isDefense(card);
  if (lower(family) === "kata") return isKata(card);
  return lower(card.cardType) === lower(family) || lower(card.subtype) === lower(family);
}

export function structuredComboRequirementEntry(card: ComboRuntimeCard | string) {
  const catalogId = catalogIdOf(card);
  return catalogId ? requirementRegistry.cards?.[catalogId] ?? null : null;
}

export function structuredComboEffects(card: ComboRuntimeCard | string) {
  const catalogId = catalogIdOf(card);
  return catalogId ? effectRegistry.cards?.[catalogId]?.effects ?? [] : [];
}

export function isStructuredCoreCombo(card: ComboRuntimeCard | string) {
  const catalogId = catalogIdOf(card);
  return catalogId.includes("-CMB-CORE-") && Boolean(structuredComboRequirementEntry(card)) && Boolean(effectRegistry.cards?.[catalogId]);
}

function historyEntries(context: ComboRuntimeContext) {
  let attackIndex = 0;
  const prior = context.priorCards.map((card) => {
    const zone = isAttack(card) ? context.zonesPlayed[attackIndex++] ?? "" : "";
    return { card, zone, current: false };
  });
  return [...prior, { card: context.currentCard, zone: context.currentZone, current: true }];
}

function stepMatches(step: ComboRequirementStep, card: ComboRuntimeCard, zone: string) {
  if (!familyMatches(card, step.family)) return false;
  if ((step.tags ?? []).some((tag) => !hasTag(card, tag))) return false;
  if (step.zone && lower(step.zone) !== lower(zone)) return false;
  return true;
}

function orderedSequenceMatches(requirement: ComboRequirement, context: ComboRuntimeContext) {
  const entries = historyEntries(context);
  let cursor = 0;
  let finalWasCurrent = false;
  for (const step of requirement.steps ?? []) {
    let matched = false;
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      if (!stepMatches(step, entry.card, entry.zone)) continue;
      matched = true;
      finalWasCurrent = entry.current;
      break;
    }
    if (!matched) return false;
  }
  return Boolean((requirement.steps ?? []).length) && finalWasCurrent;
}

function requirementSatisfied(requirement: ComboRequirement, context: ComboRuntimeContext) {
  switch (requirement.kind) {
    case "orderedSequence":
      return orderedSequenceMatches(requirement, context);
    case "orderedAttackHits": {
      if (context.currentAttackHit !== true || !isAttack(context.currentCard)) return false;
      const actual = [...(context.hitZonesThisTurn ?? []), context.currentZone].map(lower);
      const expected = (requirement.zones ?? []).map(lower);
      if (actual.length < expected.length) return false;
      return expected.every((zone, index) => actual[actual.length - expected.length + index] === zone);
    }
    case "differentZoneFromPreviousAttack": {
      const previous = context.zonesPlayed.at(-1);
      return Boolean(previous && lower(previous) !== lower(context.currentZone));
    }
    case "defenseBlocksAttack": {
      const defense = context.currentDefense ?? (isDefense(context.currentCard) ? context.currentCard : null);
      return context.currentDefenseBlocked === true && Boolean(defense) && (!requirement.tag || hasTag(defense, requirement.tag));
    }
    case "defendedThisRound":
      return context.currentDefenseBlocked === true || context.blockedThisRound === true || context.defendedThisRound;
    case "minimumDefenseTag": {
      const cards = [...context.priorCards];
      const currentDefense = context.currentDefense ?? (isDefense(context.currentCard) ? context.currentCard : null);
      if (currentDefense && !cards.includes(currentDefense)) cards.push(currentDefense);
      return cards.filter((card) => isDefense(card) && (!requirement.tag || hasTag(card, requirement.tag))).length >= Number(requirement.amount ?? 1);
    }
    case "differentComboAfterCombo":
      return (context.triggeredComboIds ?? []).length >= Number(requirement.minimumPriorCombos ?? 1);
    case "beltExamThenAttackHit":
      return Boolean(context.completedBeltExamThisRound && context.currentAttackHit === true && isAttack(context.currentCard) && (!requirement.tag || hasTag(context.currentCard, requirement.tag)));
    case "priorCardFamily":
      return context.priorCards.some((card) => familyMatches(card, requirement.family));
    case "reversal":
      return Boolean(context.isReversal);
    case "attackOrdinal":
      return isAttack(context.currentCard) && context.attacksThisTurn + 1 === Number(requirement.ordinal ?? 1);
    case "minimumPriorAttacks":
      return context.attacksThisTurn >= Number(requirement.amount ?? 1);
    case "priorAttackHit":
      return context.hitThisTurn && context.attacksThisTurn >= Number(requirement.minimumPriorAttacks ?? 1);
    case "minimumEquipment":
      return context.equipment.length >= Number(requirement.amount ?? 1);
    case "weaponAttack":
      return isAttack(context.currentCard) && (hasTag(context.currentCard, "weapon") || context.equipment.some((card) => hasTag(card, "weapon") || lower(card.subtype).includes("weapon")));
    case "zonesPresent": {
      const zones = new Set([...context.zonesPlayed, ...(isAttack(context.currentCard) ? [context.currentZone] : [])].map(lower));
      return (requirement.zones ?? []).every((zone) => zones.has(lower(zone)));
    }
    case "priorAttackTag":
      return context.priorCards.some((card) => isAttack(card) && Boolean(requirement.tag) && hasTag(card, String(requirement.tag)));
    default:
      return null;
  }
}

export function evaluateStructuredComboRequirements(card: ComboRuntimeCard | string, context: ComboRuntimeContext): ComboRequirementResult {
  const entry = structuredComboRequirementEntry(card);
  if (!entry) return { eligible: false, supported: false, reason: "Missing canonical Combo requirement definition." };
  const requirements = entry.requirements ?? [];
  if (!requirements.length) return { eligible: false, supported: false, reason: "Canonical Combo requirement definition is empty." };
  for (const requirement of requirements) {
    const satisfied = requirementSatisfied(requirement, context);
    if (satisfied === null) return { eligible: false, supported: false, reason: `Unsupported Combo requirement '${requirement.kind}'.` };
    if (!satisfied) return { eligible: false, supported: true, reason: `Requirement '${requirement.kind}' is not complete.` };
  }
  return { eligible: true, supported: true, reason: "Canonical Combo requirement complete." };
}

function immediateAttackEffects(card: ComboRuntimeCard) {
  return structuredComboEffects(card).filter((effect) =>
    effect.trigger === "onAttackDeclared"
    && effect.resolver !== "combo.delayedNextTurnAttack"
    && effect.resolver !== "combo.discardWeaponChoice",
  );
}

export function evaluateStructuredComboAttack(card: ComboRuntimeCard, context: ComboRuntimeContext): ComboAttackEvaluation {
  const requirement = evaluateStructuredComboRequirements(card, context);
  if (!requirement.eligible) return { ...requirement, power: 0, damage: 0, focusOnHit: 0, grantsFlow: false, speedOnTrigger: 0, piercing: 0, choiceRequired: false };
  const effects = immediateAttackEffects(card);
  const choiceRequired = structuredComboEffects(card).some((effect) => effect.trigger === "onAttackDeclared" && effect.resolver === "combo.discardWeaponChoice" && effect.effect === "core.choice");
  return {
    ...requirement,
    power: effects.filter((effect) => effect.effect === "combat.modifyAttackPower").reduce((sum, effect) => sum + Number(effect.amount ?? 0), 0),
    damage: 0,
    focusOnHit: structuredComboEffects(card).filter((effect) => effect.trigger === "onHit" && effect.effect === "core.gainFocus" && effect.resolver !== "combo.delayedNextInitiate").reduce((sum, effect) => sum + Number(effect.amount ?? 0), 0),
    grantsFlow: effects.some((effect) => effect.effect === "combat.grantFlow"),
    speedOnTrigger: effects.filter((effect) => effect.effect === "combat.modifySpeed").reduce((sum, effect) => sum + Number(effect.amount ?? 0), 0),
    piercing: effects.filter((effect) => effect.effect === "combat.piercing").reduce((sum, effect) => sum + Number(effect.amount ?? 0), 0),
    choiceRequired,
  };
}

export function comboCommandsForTrigger(card: ComboRuntimeCard | string, trigger: RuntimeTrigger): RuntimeCommand[] {
  return structuredComboEffects(card)
    .filter((effect) => effect.trigger === trigger)
    .filter((effect) => effect.resolver !== "combo.discardWeaponChoice")
    .filter((effect) => effect.resolver !== "combo.delayedNextInitiate")
    .filter((effect) => effect.resolver !== "combo.delayedNextTurnAttack")
    .filter((effect) => effect.resolver !== "combo.nextReactionPenalty")
    .map(runtimeCommand);
}

export function comboDeferredCommandsOnCompletion(card: ComboRuntimeCard | string, completedAt: RuntimeTrigger): RuntimeCommand[] {
  const commands: RuntimeCommand[] = [];
  for (const effect of structuredComboEffects(card)) {
    if (effect.resolver === "combo.delayedNextInitiate") {
      commands.push({ ...runtimeCommand(effect), trigger: completedAt, duration: "nextInitiate", qualifier: { activateAt: "nextInitiate" } });
    } else if (effect.resolver === "combo.delayedNextTurnAttack") {
      commands.push({ ...runtimeCommand(effect), trigger: completedAt, duration: "nextAttack", qualifier: { activateAt: "nextTurnAttack", nextAttack: true, nextTurn: true } });
    } else if (effect.resolver === "combo.nextReactionPenalty") {
      commands.push({ ...runtimeCommand(effect), trigger: completedAt, duration: "endOfRound", qualifier: { nextReaction: true } });
    }
  }
  return commands;
}

export function comboChoiceOnAttack(card: ComboRuntimeCard | string): ComboRuntimeChoice | null {
  const effects = structuredComboEffects(card).filter((effect) => effect.trigger === "onAttackDeclared" && effect.resolver === "combo.discardWeaponChoice");
  const choice = effects.find((effect) => effect.effect === "core.choice");
  if (!choice) return null;
  return {
    kind: "chooseCard",
    sourceEffectId: String(choice.id ?? "combo-choice"),
    resolver: "combo.discardWeaponChoice",
    prompt: "Choose a Weapon card from your hand to discard for this Combo.",
    source: "hand",
    filter: { tag: "Weapon" },
    action: "discard",
    optional: false,
    followupEffectIds: effects.filter((effect) => effect.effect !== "core.choice").map((effect) => String(effect.id ?? "")).filter(Boolean),
  };
}

export function comboFollowupCommands(card: ComboRuntimeCard | string, effectIds: readonly string[]) {
  const wanted = new Set(effectIds);
  return structuredComboEffects(card).filter((effect) => effect.id && wanted.has(effect.id)).map(runtimeCommand);
}
