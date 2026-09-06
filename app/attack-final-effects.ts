import cardEffectsJson from "./data/card-effects.json" with { type: "json" };

export type FinalAttackCardLike = {
  catalogId?: string | null;
  zone?: string | null;
};

type RegistryCondition = { kind?: string; operator?: string; value?: unknown };
type RegistryEffect = {
  id?: string;
  trigger?: string;
  action?: string;
  amount?: number;
  resolver?: string;
  conditions?: RegistryCondition[];
};
type Registry = { cards?: Record<string, { effects?: RegistryEffect[] }> };

const registry = cardEffectsJson as unknown as Registry;

function effects(card: FinalAttackCardLike, resolver: string) {
  const id = String(card.catalogId ?? "").trim();
  return id ? (registry.cards?.[id]?.effects ?? []).filter((effect) => effect.resolver === resolver) : [];
}

function condition(effect: RegistryEffect, kind: string) {
  return effect.conditions?.find((entry) => entry.kind === kind)?.value;
}

function compare(actual: unknown, operator: string | undefined, expected: unknown) {
  switch (operator ?? "eq") {
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
}

function conditionsMatch(effect: RegistryEffect, values: Record<string, unknown>, metadataKinds: string[] = []) {
  return (effect.conditions ?? []).every((entry) => {
    const kind = String(entry.kind ?? "");
    if (metadataKinds.includes(kind)) return true;
    return compare(values[kind], entry.operator, entry.value);
  });
}

export function finalAttackAllowedZones(card: FinalAttackCardLike, context: { boughtCardLastAscend?: boolean }) {
  const base = String(card.zone ?? "").split(",").map((zone) => zone.trim()).filter(Boolean);
  const resolverEffects = effects(card, "attack.final.alternateZone");
  if (!resolverEffects.length) return { handled: false, zones: base };
  const values = { boughtCardLastAscend: Boolean(context.boughtCardLastAscend) };
  const zones = [...base];
  for (const effect of resolverEffects) {
    if (!conditionsMatch(effect, values, ["alternateZone"])) continue;
    const alternate = condition(effect, "alternateZone");
    if (typeof alternate === "string" && !zones.includes(alternate)) zones.push(alternate);
  }
  return { handled: true, zones };
}

export function finalAttackPowerBonus(card: FinalAttackCardLike, context: {
  completedBeltExamThisRound?: boolean;
  focusGeneratedThisTurn?: number;
  firstAttackThisTurn?: boolean;
}) {
  const values = {
    completedBeltExamThisRound: Boolean(context.completedBeltExamThisRound),
    focusGeneratedThisTurn: Number(context.focusGeneratedThisTurn ?? 0),
    firstAttackThisTurn: Boolean(context.firstAttackThisTurn),
  };
  let amount = 0;
  const notes: string[] = [];
  for (const effect of effects(card, "attack.final.power")) {
    if (!conditionsMatch(effect, values)) continue;
    const value = Number(effect.amount ?? 0);
    amount += value;
    notes.push(`structured condition ${value >= 0 ? "+" : ""}${value} Attack Power`);
  }
  return { amount, notes };
}

export function finalAttackFocusReward(card: FinalAttackCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  focusSpentThisTurn?: number;
  firstNormalAttackThisTurn?: boolean;
  completesActiveBeltExam?: boolean;
}) {
  const values = {
    focusSpentEarlierThisTurn: Number(context.focusSpentThisTurn ?? 0) > 0,
    firstNormalAttackThisTurn: Boolean(context.firstNormalAttackThisTurn),
    completesActiveBeltExam: Boolean(context.completesActiveBeltExam),
  };
  return effects(card, "attack.final.focus")
    .filter((effect) => effect.trigger === context.timing && conditionsMatch(effect, values))
    .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
}

export function finalAttackCycle(card: FinalAttackCardLike, context: {
  timing: "onPlay" | "onHit" | "onBlock" | "afterResolve";
  nonHonorSceneChangedThisRound?: boolean;
  yellowBeltExamThirdZone?: boolean;
}) {
  const values = {
    nonHonorSceneChangedThisRound: Boolean(context.nonHonorSceneChangedThisRound),
    yellowBeltExamThirdZone: Boolean(context.yellowBeltExamThirdZone),
  };
  let draw = 0;
  let discard = 0;
  const resolverEffects = effects(card, "attack.final.cycle");
  for (const effect of resolverEffects) {
    if (effect.trigger !== context.timing || !conditionsMatch(effect, values)) continue;
    if (effect.action === "draw") draw += Number(effect.amount ?? 0);
    if (effect.action === "discard") discard += Number(effect.amount ?? 0);
  }
  return { handled: resolverEffects.length > 0, draw, discard };
}

export function finalAttackEquipmentSuppression(card: FinalAttackCardLike) {
  return effects(card, "attack.final.equipmentSuppression")
    .filter((effect) => effect.trigger === "onHit")
    .reduce((largest, effect) => Math.max(largest, Math.abs(Number(effect.amount ?? 0))), 0);
}

export type FinalAttackHitChoice =
  | { kind: "courtesy-notice"; itemCostPenalty: number; defenseGuardPenalty: number }
  | { kind: "discount-dim-mak"; focusGain: number }
  | { kind: "tornado-crescent"; focusGain: number; draw: number; discard: number };

export function finalAttackHitChoice(card: FinalAttackCardLike): FinalAttackHitChoice | null {
  const effect = effects(card, "attack.final.hitChoice").find((entry) => entry.trigger === "onHit");
  if (!effect) return null;
  const kind = condition(effect, "choiceKind");
  if (kind === "courtesy-notice") {
    return {
      kind,
      itemCostPenalty: Number(condition(effect, "itemCostPenalty") ?? 0),
      defenseGuardPenalty: Number(condition(effect, "defenseGuardPenalty") ?? 0),
    };
  }
  if (kind === "discount-dim-mak") return { kind, focusGain: Number(condition(effect, "focusGain") ?? 0) };
  if (kind === "tornado-crescent") {
    return {
      kind,
      focusGain: Number(condition(effect, "focusGain") ?? 0),
      draw: Number(condition(effect, "draw") ?? 0),
      discard: Number(condition(effect, "discard") ?? 0),
    };
  }
  return null;
}

export function finalAttackDefensiveReactionBonus(card: FinalAttackCardLike, incomingZone: string | null | undefined) {
  const effect = effects(card, "attack.final.defensiveReaction")[0];
  if (!effect) return 0;
  const allowed = condition(effect, "incomingZones");
  if (!Array.isArray(allowed) || !allowed.map(String).some((zone) => zone.toLocaleLowerCase() === String(incomingZone ?? "").toLocaleLowerCase())) return 0;
  return Number(effect.amount ?? 0);
}

export function finalAttackComboMultiplicity(card: FinalAttackCardLike) {
  return effects(card, "attack.final.comboMultiplicity")
    .reduce((largest, effect) => Math.max(largest, Math.max(1, Number(effect.amount ?? 1))), 1);
}

export function finalAttackFireDrillFeint(card: FinalAttackCardLike) {
  const effect = effects(card, "attack.final.fireDrillFeint")[0];
  if (!effect) return null;
  return { discardCost: Number(condition(effect, "discardCost") ?? 0) };
}

export function finalAttackOnlyAttackLock(card: FinalAttackCardLike, firstAttackThisTurn: boolean) {
  return firstAttackThisTurn && effects(card, "attack.final.onlyAttackLock").length > 0;
}

export function finalAttackOptionalAttackCost(card: FinalAttackCardLike) {
  const effect = effects(card, "attack.final.optionalAttackCost")[0];
  if (!effect) return null;
  return {
    discard: Number(condition(effect, "discardCost") ?? 0),
    power: Number(effect.amount ?? 0),
  };
}
