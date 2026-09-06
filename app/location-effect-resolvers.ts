import cardEffectsJson from "./data/card-effects.json" with { type: "json" };

export type LocationEffectLike = {
  id?: string;
  trigger?: string;
  action?: string;
  target?: string;
  amount?: number;
  duration?: string;
  resolver?: string;
  conditions?: { kind?: string; operator?: string; value?: unknown }[];
};

export type LocationCardLike = {
  catalogId?: string | null;
  name?: string;
};

type Registry = {
  cards?: Record<string, { name?: string; effects?: LocationEffectLike[] }>;
};

export type LocationContext = {
  locationEvent: string;
  [key: string]: unknown;
};

export type LocationCommand = {
  effectId: string;
  action: string;
  target: string;
  amount: number;
  duration: string;
  operation: string | null;
  metadata: Record<string, unknown>;
};

const registry = cardEffectsJson as unknown as Registry;

export const SUPPORTED_LOCATION_OPERATIONS = new Set([
  "beltExamSpeedOrCycleChoice",
  "destroyJunkGainFocusLoseHp",
  "discardForReadyOrDefenseChoice",
  "discardJunkDrawGainFocus",
  "drawThenDiscard",
  "increaseDamageReduction",
  "keepUnboughtMarketCards",
  "loseFocusIfAble",
  "modifyComboPrintedNumericEffect",
  "modifyDefensiveEquipmentContribution",
  "modifyHealing",
  "modifyKoXp",
  "modifyPurchaseCost",
  "modifyReadiedEquipmentPrintedBonus",
  "modifyStandingAttack",
  "modifyStandingDefense",
  "modifyWeaponArmorPrintedBonus",
  "modifyWeaponAttackBonus",
  "modifyXpGain",
  "nextCounterAttackChosenZone",
  "readyEquipmentOrSpeedChoice",
  "setKataFocusGeneration",
  "stateActiveBeltExam"
]);

const NON_PREDICATE_CONDITIONS = new Set([
  "locationOperation",
  "minimumFinalValue",
  "maximumFinalValue",
  "choiceOptions",
  "discardCount",
  "drawCount",
  "focusGain",
  "hpLoss",
  "fixedValue",
  "maximumLoss",
  "appliesNextRound",
]);

function entryFor(card: LocationCardLike) {
  const catalogId = String(card.catalogId ?? "").trim();
  if (!catalogId) return null;
  return registry.cards?.[catalogId] ?? null;
}

export function isStructuredLocation(card: LocationCardLike) {
  return Boolean(entryFor(card) && String(card.catalogId ?? "").toUpperCase().includes("-LOC-"));
}

export function structuredLocationEffects(card: LocationCardLike) {
  return entryFor(card)?.effects ?? [];
}

function conditionMetadata(effect: LocationEffectLike) {
  return Object.fromEntries((effect.conditions ?? []).map((condition) => [String(condition.kind ?? ""), condition.value]));
}

function defaultConditionMatch(kind: string, actual: unknown, expected: unknown) {
  if (kind.endsWith("AtLeast")) return Number(actual) >= Number(expected);
  if (kind.endsWith("Any") && Array.isArray(expected)) {
    const actualValues = Array.isArray(actual) ? actual : [actual];
    return actualValues.some((value) => expected.includes(value as never));
  }
  if (Array.isArray(expected)) {
    if (Array.isArray(actual)) return expected.every((value) => actual.includes(value));
    return expected.includes(actual as never);
  }
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

function conditionMatches(condition: { kind?: string; operator?: string; value?: unknown }, context: LocationContext) {
  const kind = String(condition.kind ?? "");
  if (!kind || NON_PREDICATE_CONDITIONS.has(kind)) return true;
  const actual = context[kind];
  const expected = condition.value;
  switch (condition.operator ?? "eq") {
    case "eq": return defaultConditionMatch(kind, actual, expected);
    case "neq": return !defaultConditionMatch(kind, actual, expected);
    case "gt": return Number(actual) > Number(expected);
    case "gte": return Number(actual) >= Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "lte": return Number(actual) <= Number(expected);
    case "includes": return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
    case "notIncludes": return Array.isArray(actual) ? !actual.includes(expected) : !String(actual ?? "").includes(String(expected ?? ""));
    default: return false;
  }
}

export function resolveLocationEffects(card: LocationCardLike, context: LocationContext): LocationCommand[] {
  return structuredLocationEffects(card)
    .filter((effect) => effect.resolver === "location.structured")
    .filter((effect) => (effect.conditions ?? []).every((condition) => conditionMatches(condition, context)))
    .map((effect) => {
      const metadata = conditionMetadata(effect);
      const operation = typeof metadata.locationOperation === "string" ? metadata.locationOperation : null;
      if (operation && !SUPPORTED_LOCATION_OPERATIONS.has(operation)) {
        throw new Error(`Unsupported Location operation '${operation}' on ${card.catalogId ?? card.name ?? "unknown Location"}.`);
      }
      return {
        effectId: String(effect.id ?? ""),
        action: String(effect.action ?? "custom"),
        target: String(effect.target ?? "self"),
        amount: Number(effect.amount ?? 0),
        duration: String(effect.duration ?? "immediate"),
        operation,
        metadata,
      };
    });
}

export function structuredLocationAttackModifiers(
  card: LocationCardLike,
  context: Omit<LocationContext, "locationEvent">,
) {
  const commands = resolveLocationEffects(card, { ...context, locationEvent: "attack" });
  let power = 0;
  let damage = 0;
  const notes: string[] = [];
  for (const command of commands) {
    if (command.action === "modifyAttackPower" || command.operation === "modifyWeaponAttackBonus") {
      power += command.amount;
      notes.push(`${command.effectId} ${command.amount >= 0 ? "+" : ""}${command.amount} Attack Power`);
    }
    if (command.action === "dealDamage") damage += command.amount;
  }
  return { power, damage, notes, commands };
}

export function structuredLocationDefenseGuardModifier(
  card: LocationCardLike,
  context: Omit<LocationContext, "locationEvent">,
) {
  const commands = resolveLocationEffects(card, { ...context, locationEvent: "defense" });
  return {
    guard: commands.filter((command) => command.action === "modifyGuard").reduce((total, command) => total + command.amount, 0),
    standingDefense: commands.filter((command) => command.operation === "modifyStandingDefense").reduce((total, command) => total + command.amount, 0),
    equipmentDefense: commands.filter((command) => command.operation === "modifyDefensiveEquipmentContribution").reduce((total, command) => total + command.amount, 0),
    commands,
  };
}

export function structuredLocationHealingModifier(
  card: LocationCardLike,
  context: Omit<LocationContext, "locationEvent">,
) {
  const commands = resolveLocationEffects(card, { ...context, locationEvent: "healing" });
  const amount = commands.filter((command) => command.operation === "modifyHealing").reduce((total, command) => total + command.amount, 0);
  const minimum = commands.reduce((value, command) => Math.max(value, Number(command.metadata.minimumFinalValue ?? 0)), 0);
  return { amount, minimum, commands };
}

export function structuredLocationPurchaseCostModifier(
  card: LocationCardLike,
  context: Omit<LocationContext, "locationEvent">,
) {
  const commands = resolveLocationEffects(card, { ...context, locationEvent: "purchase" });
  const amount = commands.filter((command) => command.operation === "modifyPurchaseCost").reduce((total, command) => total + command.amount, 0);
  const minimum = commands.reduce((value, command) => Math.max(value, Number(command.metadata.minimumFinalValue ?? 0)), 0);
  return { amount, minimum, commands };
}

export function structuredLocationKataFocusModifier(
  card: LocationCardLike,
  context: Omit<LocationContext, "locationEvent">,
) {
  const commands = resolveLocationEffects(card, { ...context, locationEvent: "kataPlay" });
  const bonus = commands.filter((command) => command.action === "gainFocus").reduce((total, command) => total + command.amount, 0);
  const setTo = commands.find((command) => command.operation === "setKataFocusGeneration")?.metadata.fixedValue;
  return { bonus, setTo: typeof setTo === "number" ? setTo : null, commands };
}
