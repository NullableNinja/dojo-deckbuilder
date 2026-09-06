export type KataCondition = {
  kind?: string;
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "includes" | "notIncludes";
  value?: unknown;
};

export type KataStructuredEffect = {
  id?: string;
  trigger: string;
  action: string;
  target?: string;
  amount?: number;
  duration?: string;
  conditions?: KataCondition[];
  resolver?: string;
};

export type KataResolverContext = {
  trigger: string;
  values?: Record<string, unknown>;
};

export type KataCommand = {
  kind: string;
  effectId?: string;
  action?: string;
  target?: string;
  amount?: number;
  duration?: string;
  resolver?: string;
  params?: Record<string, unknown>;
};

const BELT_ORDER = ["White", "Yellow", "Orange", "Green", "Blue", "Purple", "Brown", "Red", "Black"];

const PREDICATE_KINDS = new Set([
  "beltAtLeast",
  "marketCardsRemaining",
  "isFastest",
  "wasHitSinceLastTurn",
  "hasWeaponEquipped",
  "dealtDamagePreviousTurn",
  "hasTempo",
  "playedAttackThisTurn",
  "hpAtOrBelowHalfMax",
  "usedConsumableThisTurn",
  "discardedCardType",
  "discardedFocusValue",
  "attackZone",
  "differentCardTypesPlayedThisTurn",
  "learnedComboTriggeredThisTurn",
  "minimumDamage",
  "attackIsReversal",
  "firstCardPlayedThisTurn",
]);

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

function beltAtLeast(actual: unknown, expected: unknown) {
  const actualIndex = BELT_ORDER.findIndex((belt) => belt.toLowerCase() === String(actual ?? "").toLowerCase());
  const expectedIndex = BELT_ORDER.findIndex((belt) => belt.toLowerCase() === String(expected ?? "").toLowerCase());
  return actualIndex >= 0 && expectedIndex >= 0 && actualIndex >= expectedIndex;
}

function conditionMatches(condition: KataCondition, values: Record<string, unknown>) {
  const kind = String(condition.kind ?? "");
  if (!PREDICATE_KINDS.has(kind)) return true;
  if (kind === "beltAtLeast") return beltAtLeast(values.belt, condition.value);
  if (kind === "minimumDamage") return Number(values.damage ?? 0) >= Number(condition.value ?? 0);
  return compare(values[kind], condition.value, condition.operator ?? "eq");
}

function predicatesMatch(effect: KataStructuredEffect, values: Record<string, unknown>) {
  return (effect.conditions ?? []).every((condition) => conditionMatches(condition, values));
}

function params(effect: KataStructuredEffect) {
  return Object.fromEntries((effect.conditions ?? []).map((condition) => [String(condition.kind ?? ""), condition.value]));
}

function direct(effect: KataStructuredEffect): KataCommand {
  return {
    kind: "apply",
    effectId: effect.id,
    action: effect.action,
    target: effect.target ?? "self",
    amount: effect.amount,
    duration: effect.duration,
    resolver: effect.resolver,
    params: params(effect),
  };
}

function semantic(kind: string, effect: KataStructuredEffect): KataCommand {
  return {
    kind,
    effectId: effect.id,
    action: effect.action,
    resolver: effect.resolver,
    params: params(effect),
    amount: effect.amount,
    duration: effect.duration,
    target: effect.target ?? "self",
  };
}

export const SUPPORTED_KATA_RESOLVERS = new Set([
  "kata.conditional",
  "kata.deferredConditional",
  "kata.deferredEvent",
  "kata.discardBranch",
  "kata.nextAttackPiercing",
  "kata.branch",
  "kata.flowGrant",
  "kata.destroyChoice",
  "kata.purchaseDiscount",
  "kata.choice",
  "kata.attackModifier",
  "kata.equipmentActivation",
  "kata.deckLook",
  "kata.attackRestriction",
  "kata.equipmentChoice",
  "kata.controlledEscalation",
  "kata.revealUntil",
  "kata.zoneOverride",
  "kata.defenseModifier",
  "kata.linkedAttackOutcome",
  "kata.zoneAttackReward",
  "kata.recycle",
  "kata.markCard",
  "kata.damagePrevention",
  "kata.copyKata",
  "kata.recoverThenDiscard",
  "kata.comboHitReward",
  "kata.comboDiscount",
  "kata.variableCycle",
  "kata.cardTypeThreshold",
  "kata.threeZonePlan",
  "kata.equipFromHand",
  "kata.weaponModifier",
]);

export function resolveKataEffect(effect: KataStructuredEffect, context: KataResolverContext): KataCommand[] {
  if (effect.trigger !== context.trigger) return [];
  const values = context.values ?? {};
  const resolver = effect.resolver;
  if (!resolver) return predicatesMatch(effect, values) ? [direct(effect)] : [];
  if (!SUPPORTED_KATA_RESOLVERS.has(resolver)) throw new Error(`Unsupported Kata resolver: ${resolver}`);

  switch (resolver) {
    case "kata.conditional":
    case "kata.attackModifier":
    case "kata.defenseModifier":
    case "kata.nextAttackPiercing":
    case "kata.linkedAttackOutcome":
    case "kata.cardTypeThreshold":
      return predicatesMatch(effect, values) ? [direct(effect)] : [];

    case "kata.branch":
      if (!predicatesMatch(effect, values)) return [];
      if (effect.action === "custom" && params(effect).grantFlowTo) return [semantic("grantFlow", effect)];
      return [direct(effect)];
    case "kata.deferredConditional":
      return [semantic("armDeferredConditional", effect)];
    case "kata.deferredEvent":
      return predicatesMatch(effect, values) ? [semantic("resolveDeferredEvent", effect)] : [];
    case "kata.discardBranch":
      return predicatesMatch(effect, values) ? [semantic("resolveDiscardBranch", effect)] : [];
    case "kata.flowGrant":
      return [semantic("grantFlow", effect)];
    case "kata.destroyChoice":
      return [semantic("chooseAndDestroy", effect)];
    case "kata.purchaseDiscount":
      return [semantic("armPurchaseDiscount", effect)];
    case "kata.choice": {
      const required = String(params(effect).requiresCondition ?? "");
      if (required && !Boolean(values[required])) return [];
      return [semantic("promptChoice", effect)];
    }
    case "kata.equipmentActivation":
      return [semantic("promptEquipmentActivation", effect)];
    case "kata.deckLook":
      return [semantic("resolveDeckLook", effect)];
    case "kata.attackRestriction":
      return [semantic("armAttackRestriction", effect)];
    case "kata.equipmentChoice":
      return [semantic("promptEquipmentChoice", effect)];
    case "kata.controlledEscalation":
      return [semantic("armControlledEscalation", effect)];
    case "kata.revealUntil":
      return [semantic("revealUntilMatch", effect)];
    case "kata.zoneOverride":
      return [semantic("armZoneOverride", effect)];
    case "kata.zoneAttackReward":
      return [semantic("armZoneAttackReward", effect)];
    case "kata.recycle":
      return [semantic("recycleDiscardCard", effect)];
    case "kata.markCard":
      return [semantic("markCardForReward", effect)];
    case "kata.damagePrevention":
      return [semantic("armDamagePrevention", effect)];
    case "kata.copyKata":
      return [semantic("copyLastOpponentKata", effect)];
    case "kata.recoverThenDiscard":
      return [semantic("recoverThenDiscard", effect)];
    case "kata.comboHitReward":
      return predicatesMatch(effect, values) ? [semantic("resolveComboHitReward", effect)] : [];
    case "kata.comboDiscount":
      return [semantic("armComboDiscount", effect)];
    case "kata.variableCycle":
      return [semantic("promptVariableCycle", effect)];
    case "kata.threeZonePlan":
      return [semantic("armThreeZonePlan", effect)];
    case "kata.equipFromHand":
      return [semantic("equipFromHand", effect)];
    case "kata.weaponModifier":
      return [semantic("armWeaponModifier", effect)];
    default:
      return [];
  }
}

export function resolveKataEffects(effects: KataStructuredEffect[], context: KataResolverContext) {
  return effects.flatMap((effect) => resolveKataEffect(effect, context));
}
