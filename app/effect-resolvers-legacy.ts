import cardEffectsJson from "./data/card-effects.json" with { type: "json" };
import { isStructuredEquipment, structuredAfterDefenseNextAttackBonus, structuredDefenseEquipmentBonus, structuredEquipmentActivationPlan, structuredEquipmentAttackPowerBonus, structuredEquipmentCanChooseAnyZone, structuredEquipmentFirstIncomingPenalty, structuredEquipmentPiercing, structuredEquipmentSpeedModifier, structuredMandatoryDamageReduction, structuredOnEquipPlan, structuredOptionalDamageReduction, structuredPassiveEquipmentGuard, structuredPostBlockCycle, type EquipmentAttackContext, type EquipmentCardLike, type EquipmentDefenseContext } from "./equipment-structured.ts";

export type EffectCardLike = {
  catalogId?: string | null;
  name?: string;
  cardType?: string;
  subtype?: string;
  category?: string | null;
  focusValue?: string | number | null;
  zone?: string | null;
  tags?: string[];
  stats?: Record<string, string | number | null | undefined>;
  details?: Record<string, string | number | null | undefined>;
};

type RegistryEffect = {
  id?: string;
  effect?: string;
  trigger?: string;
  action?: string;
  target?: string;
  amount?: number;
  duration?: string;
  resolver?: string;
  conditions?: { kind?: string; operator?: string; value?: unknown }[];
};

type StructuredEffectRegistry = {
  cards?: Record<string, { name?: string; effects?: RegistryEffect[] }>;
};

const structuredEffectRegistry = cardEffectsJson as unknown as StructuredEffectRegistry;

function structuredEntry(card: EffectCardLike) {
  const catalogId = String(card.catalogId ?? "").trim();
  return catalogId ? structuredEffectRegistry.cards?.[catalogId] ?? null : null;
}

function structuredEffects(card: EffectCardLike) {
  return structuredEntry(card)?.effects ?? [];
}

function structuredResolvers(card: EffectCardLike, resolver: string) {
  return structuredEffects(card).filter((effect) => effect.resolver === resolver);
}

function structuredResolver(card: EffectCardLike, resolver: string) {
  return structuredResolvers(card, resolver)[0] ?? null;
}

function numberValue(value: unknown) {
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function structuredConditionsMatch(effect: RegistryEffect, values: Record<string, unknown>) {
  return (effect.conditions ?? []).every((condition) => {
    const actual = values[String(condition.kind ?? "")];
    const expected = condition.value;
    switch (condition.operator ?? "eq") {
      case "eq": return actual === expected;
      case "neq": return actual !== expected;
      case "gt": return Number(actual) > Number(expected);
      case "gte": return Number(actual) >= Number(expected);
      case "lt": return Number(actual) < Number(expected);
      case "lte": return Number(actual) <= Number(expected);
      case "includes": return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
      case "notIncludes": return Array.isArray(actual) ? !actual.includes(expected) : !String(actual ?? "").includes(String(expected ?? ""));
      default: return false;
    }
  });
}

function structuredConditionValue(effect: RegistryEffect, kind: string) {
  return effect.conditions?.find((condition) => condition.kind === kind)?.value;
}

export function isDefenseEquipment(card: EffectCardLike) {
  return String(card.subtype ?? "").toLocaleLowerCase() === "defense equipment";
}

function legacyPassiveEquipmentGuard(card: EffectCardLike) {
  if (isDefenseEquipment(card)) return 0;
  return numberValue(card.stats?.Guard);
}

export function targetDiscardOnHitCount(card: EffectCardLike) {
  return structuredEffects(card)
    .filter((effect) => effect.trigger === "onHit" && effect.target === "opponent" && ["discard", "core.discard"].includes(String(effect.action ?? effect.effect ?? "")))
    .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
}

export function targetNextAttackPenalty(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    return structuredResolvers(card, "attack.targetNextAttackPenalty")
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  return 0;
}

export function targetSpeedPenaltyUntilHonor(card: EffectCardLike, context: { previousCardIsItem?: boolean } = {}) {
  const entry = structuredEntry(card);
  if (entry) {
    const values = { previousCardIsItem: Boolean(context.previousCardIsItem) };
    return structuredResolvers(card, "attack.targetSpeedPenaltyUntilHonor")
      .filter((effect) => structuredConditionsMatch(effect, values))
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  return 0;
}

export function destroysAfterUse(card: EffectCardLike) {
  return structuredEffects(card).some((effect) => effect.action === "destroy" || effect.effect === "core.destroy");
}

function legacyDefenseEquipmentBonus(_card: EffectCardLike, _zone: string) { return 0; }
function legacyAfterDefenseNextAttackBonus(_cards: EffectCardLike[]) { return { amount: 0, sources: [] as string[] }; }

function legacyEquipmentSpeedModifier(card: EffectCardLike) {
  return 0;
}

function legacyAttackCanChooseAnyZone(card: EffectCardLike, firstAttack: boolean, equipment: EffectCardLike[] = []) {
  if (structuredResolver(card, "attack.chooseAnyZone")) return true;
  return false;
}

export function structuredFocusIfFastest(card: EffectCardLike, selfSpeed: number, opponentSpeed: number) {
  const effect = structuredResolver(card, "starter.gainFocusIfFastest");
  if (!effect) return 0;
  const hasFastestCondition = (effect.conditions ?? []).some((condition) => condition.kind === "isFastest" && condition.value === true);
  if (!hasFastestCondition || selfSpeed <= opponentSpeed) return 0;
  return Number(effect.amount ?? 0);
}

export function structuredNextAttackFlow(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  differentZoneFromPreviousAttack?: boolean;
}) {
  const effects = structuredResolvers(card, "attack.grantNextAttackFlow");
  if (!effects.length) return { handled: false, grant: false };
  const values = {
    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),
  };
  return {
    handled: true,
    grant: effects.some((effect) => effect.trigger === context.timing && structuredConditionsMatch(effect, values)),
  };
}

export function structuredConditionalFocus(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  attackNumber: number;
  usedEffectIds?: string[];
}) {
  const effects = structuredResolvers(card, "attack.conditionalFocus");
  if (!effects.length) return { handled: false, amount: 0 };
  const values = { firstAttackThisTurn: context.attackNumber === 1, attackNumber: context.attackNumber, oncePerTurn: true };
  const used = new Set(context.usedEffectIds ?? []);
  const consumed: string[] = [];
  const matched = effects.filter((effect) => {
    if (effect.trigger !== context.timing || !structuredConditionsMatch(effect, values)) return false;
    const oncePerTurn = (effect.conditions ?? []).some((condition) => condition.kind === "oncePerTurn" && condition.value === true);
    if (oncePerTurn && effect.id && used.has(effect.id)) return false;
    if (oncePerTurn && effect.id) consumed.push(effect.id);
    return true;
  });
  const result = {
    handled: true,
    amount: matched.reduce((total, effect) => total + Number(effect.amount ?? 0), 0),
  };
  return consumed.length ? { ...result, effectIds: consumed } : result;
}

export function structuredConditionalCycle(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  firstAttackThisTurn?: boolean;
  priorJumpOrSpinAttack?: boolean;
  previousAttackHit?: boolean;
  differentZoneFromPreviousAttack?: boolean;
}) {
  const effects = structuredResolvers(card, "attack.conditionalCycle");
  if (!effects.length) return { handled: false, draw: 0, discard: 0 };
  const values = {
    firstAttackThisTurn: Boolean(context.firstAttackThisTurn),
    priorJumpOrSpinAttack: Boolean(context.priorJumpOrSpinAttack),
    previousAttackHit: Boolean(context.previousAttackHit),
    differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),
  };
  let draw = 0;
  let discard = 0;
  for (const effect of effects) {
    if (effect.trigger !== context.timing || !structuredConditionsMatch(effect, values)) continue;
    if (effect.action === "draw") draw += Number(effect.amount ?? 0);
    if (effect.action === "discard") discard += Number(effect.amount ?? 0);
  }
  return { handled: true, draw, discard };
}

export function afterDefenseAttackPowerBonus(card: EffectCardLike, defenderPlayedDefense: boolean) {
  const effects = structuredResolvers(card, "attack.afterDefensePower");
  if (!effects.length) return { amount: 0, notes: [] as string[] };
  const values = { defenderPlayedDefense };
  let amount = 0;
  const notes: string[] = [];
  for (const effect of effects) {
    if (effect.trigger !== "onDefenseDeclared" || !structuredConditionsMatch(effect, values)) continue;
    const value = Number(effect.amount ?? 0);
    amount += value;
    notes.push(`Defense response ${value >= 0 ? "+" : ""}${value} Attack Power`);
  }
  return { amount, notes };
}

export function nextAttackArmorPenalty(card: EffectCardLike) {
  return structuredResolvers(card, "attack.nextAttackArmorPenalty")
    .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
}

export function structuredNextAttackAnyZone(card: EffectCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  attackNumber: number;
}) {
  const effects = structuredResolvers(card, "attack.grantNextAttackAnyZone");
  if (!effects.length) return { handled: false, grant: false };
  return {
    handled: true,
    grant: context.attackNumber > 0 && effects.some((effect) => effect.trigger === context.timing),
  };
}

export function structuredCurrentAttackFlow(card: EffectCardLike, context: { hasWeaponEquipped: boolean }) {
  const effects = structuredResolvers(card, "attack.currentAttackFlow");
  if (!effects.length) return { handled: false, hasFlow: false };
  const values = { hasWeaponEquipped: context.hasWeaponEquipped };
  return {
    handled: true,
    hasFlow: effects.some((effect) => effect.trigger === "onAttackDeclared" && structuredConditionsMatch(effect, values)),
  };
}

export function conditionalAttackPowerBonus(card: EffectCardLike, context: {
  playedKata: boolean;
  firstAttack: boolean;
  matchingArmor?: boolean;
  targetEquipmentCount?: number;
  attackNumber?: number;
  hasTempo?: boolean;
  hasFewerCardsThanTarget?: boolean;
  targetSpeedHigher?: boolean;
  priorLowAttack?: boolean;
  previousCardIsItemOrConsumable?: boolean;
  hasImprovisedWeapon?: boolean;
  wasHitSinceLastTurn?: boolean;
  differentZoneFromPreviousAttack?: boolean;
  previousAttackZoneMidOrHigh?: boolean;
  priorDifferentZoneCount?: number;
  priorPunchAttack?: boolean;
  priorSpinAttack?: boolean;
  targetTempoUsed?: boolean;
  playedAsReversal?: boolean;
  playedDefenseSinceLastTurn?: boolean;
  blockedSinceLastTurn?: boolean;
  blockedThisRound?: boolean;
  previousAttackBlocked?: boolean;
  previousCardIsKataOrItem?: boolean;
}) {
  let amount = 0;
  const notes: string[] = [];
  const entry = structuredEntry(card);
  if (entry) {
    const values = {
      playedKataThisTurn: context.playedKata,
      firstAttackThisTurn: context.firstAttack,
      targetHasMatchingArmor: Boolean(context.matchingArmor),
      targetPermanentEquipmentCount: context.targetEquipmentCount ?? 0,
      attackNumber: context.attackNumber ?? (context.firstAttack ? 1 : 0),
      hasTempo: Boolean(context.hasTempo),
      hasFewerCardsThanTarget: Boolean(context.hasFewerCardsThanTarget),
      targetSpeedHigher: Boolean(context.targetSpeedHigher),
      priorLowAttack: Boolean(context.priorLowAttack),
      previousCardIsItemOrConsumable: Boolean(context.previousCardIsItemOrConsumable),
      hasImprovisedWeapon: Boolean(context.hasImprovisedWeapon),
      wasHitSinceLastTurn: Boolean(context.wasHitSinceLastTurn),
      differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),
      previousAttackZoneMidOrHigh: Boolean(context.previousAttackZoneMidOrHigh),
      priorDifferentZoneCount: context.priorDifferentZoneCount ?? 0,
      priorPunchAttack: Boolean(context.priorPunchAttack),
      priorSpinAttack: Boolean(context.priorSpinAttack),
      targetTempoUsed: Boolean(context.targetTempoUsed),
      playedAsReversal: Boolean(context.playedAsReversal),
      playedDefenseSinceLastTurn: Boolean(context.playedDefenseSinceLastTurn),
      blockedSinceLastTurn: Boolean(context.blockedSinceLastTurn),
      blockedThisRound: Boolean(context.blockedThisRound),
      previousAttackBlocked: Boolean(context.previousAttackBlocked),
      previousCardIsKataOrItem: Boolean(context.previousCardIsKataOrItem),
    };
    for (const effect of structuredResolvers(card, "attack.conditionalPower")) {
      if (!structuredConditionsMatch(effect, values)) continue;
      const value = Number(effect.amount ?? 0);
      amount += value;
      notes.push(`structured condition ${value >= 0 ? "+" : ""}${value} Attack Power`);
    }
    return { amount, notes };
  }
  return { amount, notes };
}

function legacyEquipmentConditionalAttackPowerBonus(cards: EffectCardLike[], context: { firstAttack: boolean; attackerSpeed: number; defenderSpeed: number }) {
  return { amount: 0, sources: [] as string[] };
}

export function conditionalDefenseGuardBonus(defense: EffectCardLike, context: { weaponAttack: boolean; defenderAttackedThisRound: boolean }) {
  const values = { weaponAttack: Boolean(context.weaponAttack), defenderAttackedThisRound: Boolean(context.defenderAttackedThisRound) };
  const matched = structuredEffects(defense).filter((effect) => effect.resolver === "defense.conditionalGuard" && structuredConditionsMatch(effect, values));
  return { amount: matched.reduce((total, effect) => total + Number(effect.amount ?? 0), 0), notes: matched.map((effect) => `structured condition +${Number(effect.amount ?? 0)} Guard`) };
}

export function conditionalHealAfterHit(card: EffectCardLike, wasHitSinceLastTurn: boolean) {
  return wasHitSinceLastTurn ? structuredEffects(card).filter((effect) => effect.action === "heal" && structuredConditionsMatch(effect, { wasHitSinceLastTurn: true })).reduce((total, effect) => total + Number(effect.amount ?? 0), 0) : 0;
}

export function locationAttackRuleModifiers(location: EffectCardLike, context: { zone: string; firstAttack: boolean; attackTags: string[]; hasWeapon: boolean; equipmentTags: string[] }) {
  const values = { attackZone: context.zone, firstAttackThisTurn: context.firstAttack, attackHasAnyTag: context.attackTags, hasWeapon: context.hasWeapon, equipmentTagAny: context.equipmentTags };
  const matched = structuredEffects(location).filter((effect) => effect.resolver === "location.structured" && structuredConditionsMatch(effect, values));
  return { power: matched.filter((effect) => String(effect.action ?? effect.effect).includes("AttackPower")).reduce((total, effect) => total + Number(effect.amount ?? 0), 0), damage: matched.filter((effect) => String(effect.action ?? effect.effect).includes("Damage")).reduce((total, effect) => total + Number(effect.amount ?? 0), 0), notes: matched.map((effect) => `structured location ${effect.id ?? "effect"}`), matched: matched.length };
}

export function destroyJunkChoiceCount(card: EffectCardLike) {
  return structuredEffects(card).filter((effect) => effect.action === "destroy" && (effect.conditions ?? []).some((condition) => ["cardType", "cardFamily", "eligibleSubtypes"].includes(String(condition.kind)))).reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
}

export function optionalDiscardDrawChoice(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    const effect = structuredResolver(card, "attack.optionalDiscardDraw");
    if (!effect) return null;
    return {
      discard: Number(structuredConditionValue(effect, "discardCost") ?? 0),
      draw: Number(structuredConditionValue(effect, "drawAfterCost") ?? 0),
    };
  }
  return null;
}

function legacyFirstIncomingAttackPowerPenalty(cards: EffectCardLike[], isFirstIncomingAttack: boolean) {
  return { amount: 0, sources: [] as string[] };
}

export function targetNextDefensePenalty(card: EffectCardLike) {
  return structuredEffects(card).filter((effect) => effect.trigger === "onPlay" && effect.target === "opponent" && ["modifyGuard", "modifyDefense"].includes(String(effect.action ?? ""))).reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
}

export function attackPiercing(card: EffectCardLike, context: {
  matchingArmor: boolean;
  targetEquipmentCount: number;
  targetHasExhaustedEquipment?: boolean;
  speedChangedThisRound?: boolean;
}) {
  let amount = 0;
  const notes: string[] = [];
  const add = (value: number, note: string) => { amount += value; notes.push(note); };
  const entry = structuredEntry(card);
  if (entry) {
    const values = {
      targetHasMatchingArmor: context.matchingArmor,
      targetPermanentEquipmentCount: context.targetEquipmentCount,
      targetHasExhaustedEquipment: Boolean(context.targetHasExhaustedEquipment),
      selfSpeedChangedThisRound: Boolean(context.speedChangedThisRound),
    };
    for (const effect of structuredResolvers(card, "attack.piercing")) {
      if (!structuredConditionsMatch(effect, values)) continue;
      const value = Number(effect.amount ?? 0);
      add(value, `structured Piercing ${value}`);
    }
    return { amount, notes };
  }

  return { amount, notes };
}

function legacyEquipmentPiercing(cards: EffectCardLike[], context: {
  firstAttack: boolean;
  zone: string;
  matchingArmor: boolean;
}) {
  return { amount: 0, sources: [] as string[] };
}

export function mandatoryDiscardChoiceCount(card: EffectCardLike) {
  return structuredEffects(card).filter((effect) => effect.action === "discard" && effect.trigger !== "onPlay").reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
}

export function discardChoiceFollowup(source: EffectCardLike, discarded: EffectCardLike) {
  let focus = 0;
  let nextAttackPower = 0;
  let nextDefenseGuard = 0;
  const notes: string[] = [];
  const values = { discardedFocusValue: Number(discarded.focusValue ?? 0), discardedCardType: discarded.cardType ?? discarded.subtype ?? discarded.category };
  for (const effect of structuredResolvers(source, "kata.discardBranch")) {
    if (!structuredConditionsMatch(effect, values)) continue;
    const action = String(effect.action ?? effect.effect ?? "");
    if (action === "gainFocus") focus += Number(effect.amount ?? 0);
    if (action === "modifyAttackPower") nextAttackPower += Number(effect.amount ?? 0);
    if (action === "modifyGuard") nextDefenseGuard += Number(effect.amount ?? 0);
    notes.push(`structured discard branch ${effect.id ?? "effect"}`);
  }
  return { focus, nextAttackPower, nextDefenseGuard, notes };
}

export type DeckLookPlan =
  | { kind: 'pick-discard'; count: number; filter: 'defense-or-kata'; optional: false; noMatchFocus: number }
  | { kind: 'reorder'; count: number; distinctTypeFocus: number }
  | { kind: 'pick-reorder'; count: number; filter: 'technique'; optional: false }
  | { kind: 'pick-shuffle'; count: number; filter: 'item'; optional: true };

export function deckLookPlan(card: EffectCardLike): DeckLookPlan | null {
  const effects = structuredEffects(card);
  const deckLook = effects.find((effect) => ["kata.deckLook", "defense.deckLookChoice", "consumable.topThreeAttackSelection", "consumable.reorderTopThree"].includes(String(effect.resolver)));
  if (!deckLook) return null;
  const value = (kind: string, fallback = 0) => Number(structuredConditionValue(deckLook, kind) ?? fallback);
  const eligible = structuredConditionValue(deckLook, "eligibleTypes");
  if (String(deckLook.resolver) === "consumable.reorderTopThree") return { kind: "reorder", count: value("lookCount", 3), distinctTypeFocus: value("differentCardTypesFocus", value("bonusFocus", 0)) };
  if (Array.isArray(eligible) && eligible.includes("Technique")) return { kind: "pick-reorder", count: value("lookCount", 1), filter: "technique", optional: false };
  if (Array.isArray(eligible) && eligible.includes("Item")) return { kind: "pick-shuffle", count: value("lookCount", 1), filter: "item", optional: true };
  if (String(deckLook.resolver) === "defense.deckLookChoice" || Array.isArray(eligible) && eligible.includes("Defense")) return { kind: "pick-discard", count: value("lookCount", 2), filter: "defense-or-kata", optional: false, noMatchFocus: value("noMatchFocus", 0) };
  return null;
}

export type EquipmentActivationPlan =
  | { kind: "speed-cycle"; speed: number; draw: number; discard: number }
  | { kind: "next-attack-power"; power: number }
  | { kind: "zone-attack"; power: number; piercing: number; blockedFocus: number; requireDifferentPreviousZone: boolean }
  | { kind: "incoming-zone-penalty"; attackPowerPenalty: number }
  | { kind: "defense-guard"; guard: number; reversalPower: number }
  | { kind: "initiate-tempo-focus"; focus: number }
  | { kind: "after-kata-focus"; focus: number }
  | { kind: "first-hit-discard-focus"; discard: number; focus: number }
  | { kind: "hit-direct-damage"; damage: number }
  | { kind: "hit-next-initiate-focus"; focus: number }
  | { kind: "numbered-attack-power"; attackNumber: number; power: number; minBelt: string };

function legacyEquipmentActivationPlan(card: EffectCardLike): EquipmentActivationPlan | null {
  return null;
}

export function readyEquipmentOnHit(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    return structuredResolvers(card, "attack.readyEquipmentOnHit")
      .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
  }
  return 0;
}

function legacyMandatoryDamageReductionEquipment(card: EffectCardLike) {
  return null;
}

function legacyOptionalCombatDamageReductionEquipment(card: EffectCardLike) {
  return null;
}

function legacyPostBlockEquipmentCycle(card: EffectCardLike) {
  return null;
}


// Compatibility wrapper names are retained for the existing Playtest call sites.
// Canonical catalog cards are resolved from generated structured data; missing
// structured fixtures return neutral values and never parse printed card text.
export function passiveEquipmentGuard(card: EffectCardLike) {
  const value = structuredPassiveEquipmentGuard(card as EquipmentCardLike);
  return value == null ? legacyPassiveEquipmentGuard(card) : value;
}

export function defenseEquipmentBonus(card: EffectCardLike, zone: string, context: EquipmentDefenseContext = {}) {
  const value = structuredDefenseEquipmentBonus(card as EquipmentCardLike, zone, context);
  return value == null ? legacyDefenseEquipmentBonus(card, zone) : value;
}

export function afterDefenseNextAttackBonus(cards: EffectCardLike[]) {
  const structuredCards = cards.filter((card) => isStructuredEquipment(card as EquipmentCardLike));
  const legacyCards = cards.filter((card) => !isStructuredEquipment(card as EquipmentCardLike));
  const structured = structuredAfterDefenseNextAttackBonus(structuredCards as EquipmentCardLike[]);
  const legacy = legacyAfterDefenseNextAttackBonus(legacyCards);
  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources] };
}

export function equipmentSpeedModifier(card: EffectCardLike) {
  const value = structuredEquipmentSpeedModifier(card as EquipmentCardLike);
  return value == null ? legacyEquipmentSpeedModifier(card) : value;
}

export function attackCanChooseAnyZone(card: EffectCardLike, firstAttack: boolean, equipment: EffectCardLike[] = []) {
  const structuredCards = equipment.filter((item) => isStructuredEquipment(item as EquipmentCardLike));
  const legacyCards = equipment.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));
  const structured = structuredEquipmentCanChooseAnyZone(structuredCards as EquipmentCardLike[], firstAttack);
  if (structured.grant) return true;
  return legacyAttackCanChooseAnyZone(card, firstAttack, legacyCards);
}

export function equipmentConditionalAttackPowerBonus(cards: EffectCardLike[], context: { firstAttack: boolean; attackerSpeed: number; defenderSpeed: number } & Partial<EquipmentAttackContext>) {
  const structuredCards = cards.filter((item) => isStructuredEquipment(item as EquipmentCardLike));
  const legacyCards = cards.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));
  const structured = structuredEquipmentAttackPowerBonus(structuredCards as EquipmentCardLike[], context);
  const legacy = legacyEquipmentConditionalAttackPowerBonus(legacyCards, context);
  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources], unsupported: structured.unsupported };
}

export function firstIncomingAttackPowerPenalty(cards: EffectCardLike[], isFirstIncomingAttack: boolean) {
  const structuredCards = cards.filter((item) => isStructuredEquipment(item as EquipmentCardLike));
  const legacyCards = cards.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));
  const structured = structuredEquipmentFirstIncomingPenalty(structuredCards as EquipmentCardLike[], isFirstIncomingAttack);
  const legacy = legacyFirstIncomingAttackPowerPenalty(legacyCards, isFirstIncomingAttack);
  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources] };
}

export function equipmentPiercing(cards: EffectCardLike[], context: { firstAttack: boolean; zone: string; matchingArmor: boolean; attackTags?: string[] }) {
  const structuredCards = cards.filter((item) => isStructuredEquipment(item as EquipmentCardLike));
  const legacyCards = cards.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));
  const structured = structuredEquipmentPiercing(structuredCards as EquipmentCardLike[], context);
  const legacy = legacyEquipmentPiercing(legacyCards, context);
  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources] };
}

export function equipmentActivationPlan(card: EffectCardLike): EquipmentActivationPlan | null {
  const structured = structuredEquipmentActivationPlan(card as EquipmentCardLike);
  if (structured !== undefined) return structured as EquipmentActivationPlan | null;
  return legacyEquipmentActivationPlan(card);
}

export function mandatoryDamageReductionEquipment(card: EffectCardLike) {
  const structured = structuredMandatoryDamageReduction(card as EquipmentCardLike);
  return structured === undefined ? legacyMandatoryDamageReductionEquipment(card) : structured;
}

export function optionalCombatDamageReductionEquipment(card: EffectCardLike) {
  const structured = structuredOptionalDamageReduction(card as EquipmentCardLike);
  return structured === undefined ? legacyOptionalCombatDamageReductionEquipment(card) : structured;
}

export function postBlockEquipmentCycle(card: EffectCardLike) {
  const structured = structuredPostBlockCycle(card as EquipmentCardLike);
  return structured === undefined ? legacyPostBlockEquipmentCycle(card) : structured;
}

export function equipmentOnEquipPlan(card: EffectCardLike, enteringCard?: EffectCardLike, context: { sourceActivationArmed?: boolean; beltName?: string } = {}) {
  return structuredOnEquipPlan(card as EquipmentCardLike, enteringCard as EquipmentCardLike | undefined, context) ?? null;
}
