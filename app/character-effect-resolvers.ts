export type CharacterCondition = {
  kind?: string;
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "includes" | "notIncludes";
  value?: unknown;
};

export type CharacterStructuredEffect = {
  id?: string;
  effect?: string;
  trigger: string;
  action?: string;
  target?: string;
  amount?: number;
  duration?: string;
  conditions?: CharacterCondition[];
  resolver?: string;
};

export type CharacterActor = "player" | "ai";
export type CharacterUsageScope = "none" | "turn" | "round" | "game";

export type CharacterResolverContext = {
  trigger: string;
  actor?: CharacterActor;
  belt?: number | string;
  activeResolvers?: string[];
  values?: Record<string, unknown>;
  usedEffectIdsThisTurn?: string[];
  usedEffectIdsThisRound?: string[];
  usedEffectIdsThisGame?: string[];
};

export type CharacterCommand = {
  kind: "apply" | "choice" | "zone-choice";
  effectId?: string;
  effect?: string;
  action?: string;
  target?: string;
  amount?: number;
  duration?: string;
  resolver: string;
  usageScope: CharacterUsageScope;
  requiresDecision: boolean;
};

export type CharacterRuntimeState = {
  usedEffectIdsThisTurn: string[];
  usedEffectIdsThisRound: string[];
  usedEffectIdsThisGame: string[];
  marks: Record<string, unknown>;
};

const BELT_ORDER = ["White", "Yellow", "Orange", "Green", "Blue", "Purple", "Brown", "Red", "Black"];
const GREEN_BELT_INDEX = 3;

const TURN_RESOLVERS = new Set([
  "character.green.linkedChangedAttackHit",
  "character.green.linkedAttackHitRecycle",
  "character.twoZoneSpeed",
  "character.green.linkedSpeedTempoFlow",
  "character.xpTrailFirstHit",
  "character.firstAttackAfterConsumable",
  "character.green.linkedAttackHitPenalty",
  "character.firstHighAttackToMid",
  "character.green.linkedChangedAttackHitCycle",
  "character.green.linkedAttackHitFocus",
  "character.green.linkedRecycleLowAttack",
  "character.firstKickDifferentZone",
  "character.firstUnarmedAttack",
  "character.firstKataDefenseZone",
  "character.revealConsumableCycle",
  "character.firstKataSpeed",
  "character.conditionalAttackPower",
  "character.green.linkedAttackHitRewardChoice",
  "character.secondKickNextKickFlow",
  "character.noCombatDamagePreviousTurnCycle",
  "character.thirdDifferentCardTypeCycle",
  "character.afterAttackDifferentZone"
]);

const GAME_RESOLVERS = new Set([
  "character.ignoreTemporaryAttackBonusesOnceGame",
  "character.revealReplacementOnceGame"
]);

const UNLIMITED_RESOLVERS = new Set([
  "character.cannotEquipWeapons",
  "character.green.promotionCycle"
]);

const CHOICE_EFFECTS = new Set(["core.choice", "combat.chooseZone"]);

function compare(actual: unknown, expected: unknown, operator = "eq") {
  switch (operator) {
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

function beltIndex(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  return BELT_ORDER.findIndex((belt) => belt.toLowerCase() === String(value ?? "").toLowerCase());
}

export function greenCharacterAbilityUnlocked(belt: unknown) {
  return beltIndex(belt) >= GREEN_BELT_INDEX;
}

export function characterUsageScope(resolver: string): CharacterUsageScope {
  if (UNLIMITED_RESOLVERS.has(resolver)) return "none";
  if (GAME_RESOLVERS.has(resolver)) return "game";
  if (TURN_RESOLVERS.has(resolver)) return "turn";
  return "round";
}

export function isSupportedCharacterResolver(resolver: unknown) {
  return /^character\.(?:green\.)?[A-Za-z][A-Za-z0-9]*$/.test(String(resolver ?? ""));
}

function conditionsMatch(effect: CharacterStructuredEffect, values: Record<string, unknown>) {
  return (effect.conditions ?? []).every((condition) => compare(
    values[String(condition.kind ?? "")],
    condition.value,
    condition.operator ?? "eq",
  ));
}

function wasUsed(effectId: string | undefined, scope: CharacterUsageScope, context: CharacterResolverContext) {
  if (!effectId || scope === "none") return false;
  if (scope === "turn") return (context.usedEffectIdsThisTurn ?? []).includes(effectId);
  if (scope === "round") return (context.usedEffectIdsThisRound ?? []).includes(effectId);
  return (context.usedEffectIdsThisGame ?? []).includes(effectId);
}

export function resolveCharacterEffect(effect: CharacterStructuredEffect, context: CharacterResolverContext): CharacterCommand[] {
  const resolver = String(effect.resolver ?? "");
  if (!isSupportedCharacterResolver(resolver)) throw new Error(`Unsupported Character resolver: ${resolver || "(missing)"}`);
  if (resolver.startsWith("character.green.") && !greenCharacterAbilityUnlocked(context.belt)) return [];
  if (effect.trigger !== "passive" && effect.trigger !== context.trigger) return [];
  if (effect.trigger === "passive" && !(context.activeResolvers ?? []).includes(resolver)) return [];
  if (!conditionsMatch(effect, context.values ?? {})) return [];
  const usageScope = characterUsageScope(resolver);
  if (wasUsed(effect.id, usageScope, context)) return [];
  const requiresDecision = CHOICE_EFFECTS.has(String(effect.effect ?? ""));
  return [{
    kind: effect.effect === "combat.chooseZone" ? "zone-choice" : requiresDecision ? "choice" : "apply",
    effectId: effect.id,
    effect: effect.effect,
    action: effect.action,
    target: effect.target,
    amount: effect.amount,
    duration: effect.duration,
    resolver,
    usageScope,
    requiresDecision,
  }];
}

export function resolveCharacterEffects(effects: CharacterStructuredEffect[], context: CharacterResolverContext) {
  return effects.flatMap((effect) => resolveCharacterEffect(effect, context));
}

export function createCharacterRuntimeState(): CharacterRuntimeState {
  return { usedEffectIdsThisTurn: [], usedEffectIdsThisRound: [], usedEffectIdsThisGame: [], marks: {} };
}

export function consumeCharacterCommand(state: CharacterRuntimeState, command: CharacterCommand) {
  if (!command.effectId || command.usageScope === "none") return state;
  const key = command.usageScope === "turn" ? "usedEffectIdsThisTurn"
    : command.usageScope === "round" ? "usedEffectIdsThisRound"
    : "usedEffectIdsThisGame";
  if (state[key].includes(command.effectId)) return state;
  return { ...state, [key]: [...state[key], command.effectId] };
}

export function resetCharacterRuntimeState(state: CharacterRuntimeState, scope: "turn" | "round") {
  if (scope === "turn") return { ...state, usedEffectIdsThisTurn: [], marks: {} };
  return { ...state, usedEffectIdsThisTurn: [], usedEffectIdsThisRound: [], marks: {} };
}

function scoredCandidates(values: Record<string, unknown>) {
  const raw = Array.isArray(values.candidates) ? values.candidates : [];
  return [...raw].sort((left, right) => {
    const leftObject = left && typeof left === "object" ? left as { id?: unknown; score?: unknown } : { id: left, score: 0 };
    const rightObject = right && typeof right === "object" ? right as { id?: unknown; score?: unknown } : { id: right, score: 0 };
    return Number(rightObject.score ?? 0) - Number(leftObject.score ?? 0)
      || String(leftObject.id ?? "").localeCompare(String(rightObject.id ?? ""));
  });
}

function aiZone(values: Record<string, unknown>) {
  const zones = Array.isArray(values.legalZones) ? values.legalZones.map(String) : ["High", "Mid", "Low"];
  const defense = values.opponentZoneDefense && typeof values.opponentZoneDefense === "object"
    ? values.opponentZoneDefense as Record<string, number>
    : {};
  return [...zones].sort((left, right) => Number(defense[left] ?? 0) - Number(defense[right] ?? 0) || left.localeCompare(right))[0] ?? "Mid";
}

export function characterDecision(command: CharacterCommand, context: CharacterResolverContext) {
  if (!command.requiresDecision) return { mode: "automatic" as const };
  if ((context.actor ?? "player") === "player") return { mode: "player" as const, requiresChoice: true as const };
  if (command.kind === "zone-choice") return { mode: "ai" as const, choice: aiZone(context.values ?? {}) };
  const candidate = scoredCandidates(context.values ?? {})[0];
  const candidateId = candidate && typeof candidate === "object" ? (candidate as { id?: unknown }).id ?? candidate : candidate;
  return { mode: "ai" as const, choice: candidateId ?? "use" };
}
