import cardEffectsJson from "./data/card-effects.json" with { type: "json" };

export type RuntimeTrigger =
  | "onPlay"
  | "onHit"
  | "onBlock"
  | "afterResolve"
  | "onAttackDeclared"
  | "onDefenseDeclared"
  | "onPurchase"
  | "onEquip"
  | "onInitiate"
  | "onHide"
  | "passive";

export type RuntimeDuration =
  | "immediate"
  | "nextAttack"
  | "nextDefense"
  | "nextDamage"
  | "nextIncomingAttack"
  | "nextInitiate"
  | "nextPurchase"
  | "nextKata"
  | "nextRound"
  | "nextTurn"
  | "endOfTurn"
  | "endOfRound"
  | "nextHonor"
  | "whileEquipped"
  | string;

export type RuntimeTarget = "self" | "opponent" | "source" | "chosen-card" | "chosen-equipment" | string;

export type RuntimeCondition = {
  kind?: string;
  operator?: string;
  value?: unknown;
};

export type StructuredRuntimeEffect = {
  id?: string;
  effect?: string;
  action?: string;
  trigger?: RuntimeTrigger | string;
  target?: RuntimeTarget;
  amount?: number;
  duration?: RuntimeDuration;
  resolver?: string;
  conditions?: RuntimeCondition[];
};

export type StructuredRuntimeCard = {
  name?: string;
  effects?: StructuredRuntimeEffect[];
};

type StructuredEffectRegistry = {
  cards?: Record<string, StructuredRuntimeCard>;
};

export type RuntimeCardLike = {
  catalogId?: string | null;
  name?: string;
};

export type RuntimeStatus = {
  sourceEffectId: string;
  effect: string;
  target: RuntimeTarget;
  amount: number;
  duration: RuntimeDuration;
  resolver?: string;
  qualifier?: Record<string, unknown>;
  appliedImmediately?: boolean;
};

export type RuntimeChoice = {
  sourceEffectId: string;
  resolver: string;
  target: RuntimeTarget;
  amount: number;
  payload: Record<string, unknown>;
};

export type RuntimeSideState = {
  hp: number;
  maxHp: number;
  focus: number;
  xp: number;
  speed: number;
  attack: number;
  defense: number;
  guard: number;
  draw: number;
  discard: number;
  reveal: number;
  destroyed: number;
  damagePrevention: number;
  purchaseCostModifier: number;
  equipmentReady: number;
  equipmentExhausted: number;
  flow: boolean;
};

export type FamilyRuntimeState = {
  self: RuntimeSideState;
  opponent: RuntimeSideState;
  statuses: RuntimeStatus[];
  pendingChoices: RuntimeChoice[];
  restrictions: string[];
  notes: string[];
};

export type RuntimeCommand = {
  sourceEffectId: string;
  effect: string;
  trigger: RuntimeTrigger | string;
  target: RuntimeTarget;
  amount: number;
  duration: RuntimeDuration;
  resolver?: string;
  conditions: RuntimeCondition[];
  qualifier?: Record<string, unknown>;
  choice?: Record<string, unknown>;
};

const registry = cardEffectsJson as unknown as StructuredEffectRegistry;

const GENERIC_EXECUTABLE_EFFECTS = new Set([
  "core.draw",
  "core.discard",
  "core.heal",
  "core.gainFocus",
  "core.gainXP",
  "core.destroy",
  "core.reveal",
  "combat.modifySpeed",
  "combat.modifyAttackPower",
  "combat.modifyDefense",
  "combat.modifyGuard",
  "combat.preventDamage",
  "combat.dealDamage",
  "combat.grantFlow",
  "combat.chooseZone",
  "economy.modifyCost",
  "equipment.ready",
  "equipment.exhaust",
]);

export function structuredRuntimeCard(card: RuntimeCardLike | string) {
  const catalogId = typeof card === "string" ? card : String(card.catalogId ?? "").trim();
  return catalogId ? registry.cards?.[catalogId] ?? null : null;
}

export function structuredRuntimeEffects(card: RuntimeCardLike | string) {
  return structuredRuntimeCard(card)?.effects ?? [];
}

export function structuredRuntimeResolvers(card: RuntimeCardLike | string, resolver: string) {
  return structuredRuntimeEffects(card).filter((effect) => effect.resolver === resolver);
}

export function conditionValue(effect: StructuredRuntimeEffect, kind: string) {
  return effect.conditions?.find((condition) => condition.kind === kind)?.value;
}

export function conditionsMatch(effect: StructuredRuntimeEffect, values: Record<string, unknown>) {
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
      case "includes": return Array.isArray(actual)
        ? actual.includes(expected)
        : String(actual ?? "").includes(String(expected ?? ""));
      case "notIncludes": return Array.isArray(actual)
        ? !actual.includes(expected)
        : !String(actual ?? "").includes(String(expected ?? ""));
      default: return false;
    }
  });
}

export function isGenericExecutableEffect(effect: StructuredRuntimeEffect) {
  return GENERIC_EXECUTABLE_EFFECTS.has(String(effect.effect ?? "")) && !effect.resolver;
}

export function runtimeCommand(effect: StructuredRuntimeEffect): RuntimeCommand {
  return {
    sourceEffectId: String(effect.id ?? "anonymous-structured-effect"),
    effect: String(effect.effect ?? effect.action ?? "core.custom"),
    trigger: String(effect.trigger ?? "onPlay"),
    target: String(effect.target ?? "self"),
    amount: Number(effect.amount ?? 0),
    duration: String(effect.duration ?? "immediate"),
    resolver: effect.resolver,
    conditions: effect.conditions ?? [],
  };
}

export function createFamilyRuntimeState(overrides: Partial<FamilyRuntimeState> = {}): FamilyRuntimeState {
  const side = (): RuntimeSideState => ({
    hp: 10,
    maxHp: 10,
    focus: 0,
    xp: 0,
    speed: 0,
    attack: 0,
    defense: 0,
    guard: 0,
    draw: 0,
    discard: 0,
    reveal: 0,
    destroyed: 0,
    damagePrevention: 0,
    purchaseCostModifier: 0,
    equipmentReady: 0,
    equipmentExhausted: 0,
    flow: false,
  });
  return {
    self: overrides.self ? { ...side(), ...overrides.self } : side(),
    opponent: overrides.opponent ? { ...side(), ...overrides.opponent } : side(),
    statuses: overrides.statuses ?? [],
    pendingChoices: overrides.pendingChoices ?? [],
    restrictions: overrides.restrictions ?? [],
    notes: overrides.notes ?? [],
  };
}

function targetSide(state: FamilyRuntimeState, target: RuntimeTarget) {
  return target === "opponent" ? state.opponent : state.self;
}

function applySideOperation(side: RuntimeSideState, command: RuntimeCommand, direction = 1) {
  const amount = command.amount * direction;
  switch (command.effect) {
    case "core.draw": if (direction > 0) side.draw += Math.max(0, command.amount); break;
    case "core.discard": if (direction > 0) side.discard += Math.max(0, command.amount); break;
    case "core.heal": if (direction > 0) side.hp = Math.min(side.maxHp, side.hp + Math.max(0, command.amount)); break;
    case "core.gainFocus": if (direction > 0) side.focus = Math.max(0, side.focus + command.amount); break;
    case "core.gainXP": if (direction > 0) side.xp = Math.max(0, side.xp + command.amount); break;
    case "core.destroy": if (direction > 0) side.destroyed += Math.max(0, command.amount || 1); break;
    case "core.reveal": if (direction > 0) side.reveal += Math.max(0, command.amount); break;
    case "combat.modifySpeed": side.speed += amount; break;
    case "combat.modifyAttackPower": side.attack += amount; break;
    case "combat.modifyDefense": side.defense += amount; break;
    case "combat.modifyGuard": side.guard += amount; break;
    case "combat.preventDamage": if (direction > 0) side.damagePrevention += Math.max(0, command.amount); break;
    case "combat.dealDamage": if (direction > 0) side.hp = Math.max(0, side.hp - Math.max(0, command.amount)); break;
    case "combat.grantFlow": if (direction > 0) side.flow = true; break;
    case "economy.modifyCost": side.purchaseCostModifier += amount; break;
    case "equipment.ready": if (direction > 0) side.equipmentReady += Math.max(0, command.amount || 1); break;
    case "equipment.exhaust": if (direction > 0) side.equipmentExhausted += Math.max(0, command.amount || 1); break;
  }
}

function persistentEffectAppliesImmediately(command: RuntimeCommand) {
  if (command.qualifier?.nextAttack || command.qualifier?.nextAttackTag || command.qualifier?.nextAttackZone || command.qualifier?.nextIncomingAttack || command.qualifier?.nextDamageEvent || command.qualifier?.nextReversal || command.qualifier?.nextKata || command.qualifier?.activateAt) return false;
  if (["nextAttack", "nextDefense", "nextDamage", "nextIncomingAttack", "nextInitiate", "nextPurchase", "nextKata", "nextRound", "nextTurn"].includes(command.duration)) return false;
  if (command.effect === "core.gainFocus" && command.qualifier?.spendOnlyOn) return true;
  if (command.effect === "core.custom" && command.qualifier?.stat) return true;
  return ["combat.modifySpeed", "combat.modifyDefense", "combat.modifyGuard"].includes(command.effect);
}

function applyCustomImmediate(next: FamilyRuntimeState, command: RuntimeCommand, direction = 1) {
  const side = targetSide(next, command.target);
  if (command.qualifier?.setValue !== undefined && command.resolver?.includes("setSpeedToValue")) {
    if (direction > 0) side.speed = Number(command.qualifier.setValue);
    return true;
  }
  if (command.qualifier?.stat === "ATK") {
    side.attack += command.amount * direction;
    return true;
  }
  if (command.qualifier?.stat === "DEF") {
    side.defense += command.amount * direction;
    return true;
  }
  return false;
}

function shouldPersist(command: RuntimeCommand) {
  return command.duration !== "immediate";
}

export function applyRuntimeCommand(state: FamilyRuntimeState, command: RuntimeCommand): FamilyRuntimeState {
  const next: FamilyRuntimeState = {
    self: { ...state.self },
    opponent: { ...state.opponent },
    statuses: [...state.statuses],
    pendingChoices: [...state.pendingChoices],
    restrictions: [...state.restrictions],
    notes: [...state.notes],
  };

  if (command.choice || command.effect === "core.choice") {
    next.pendingChoices.push({
      sourceEffectId: command.sourceEffectId,
      resolver: command.resolver ?? "core.choice",
      target: command.target,
      amount: command.amount,
      payload: command.choice ?? {},
    });
    return next;
  }

  if (shouldPersist(command)) {
    let appliedImmediately = false;
    if (persistentEffectAppliesImmediately(command)) {
      if (command.effect === "core.custom") appliedImmediately = applyCustomImmediate(next, command);
      else {
        applySideOperation(targetSide(next, command.target), command);
        appliedImmediately = true;
      }
    }
    if (command.effect === "core.gainFocus" && command.qualifier?.spendOnlyOn && !appliedImmediately) {
      applySideOperation(targetSide(next, command.target), command);
      appliedImmediately = true;
    }
    next.statuses.push({
      sourceEffectId: command.sourceEffectId,
      effect: command.effect,
      target: command.target,
      amount: command.amount,
      duration: command.duration,
      resolver: command.resolver,
      qualifier: command.qualifier,
      appliedImmediately,
    });
    if (command.qualifier?.restriction && !next.restrictions.includes(String(command.qualifier.restriction))) {
      next.restrictions.push(String(command.qualifier.restriction));
    }
    return next;
  }

  const side = targetSide(next, command.target);
  if (command.effect === "core.custom") {
    if (!applyCustomImmediate(next, command) && command.resolver) next.restrictions.push(command.resolver);
  } else {
    applySideOperation(side, command);
  }
  if (command.qualifier?.restriction && !next.restrictions.includes(String(command.qualifier.restriction))) {
    next.restrictions.push(String(command.qualifier.restriction));
  }
  return next;
}

export function applyRuntimeCommands(state: FamilyRuntimeState, commands: RuntimeCommand[]) {
  return commands.reduce(applyRuntimeCommand, state);
}

function revertStatus(next: FamilyRuntimeState, status: RuntimeStatus) {
  if (!status.appliedImmediately) return;
  const command: RuntimeCommand = {
    sourceEffectId: status.sourceEffectId,
    effect: status.effect,
    trigger: "passive",
    target: status.target,
    amount: status.amount,
    duration: status.duration,
    resolver: status.resolver,
    conditions: [],
    qualifier: status.qualifier,
  };
  if (command.effect === "core.custom") applyCustomImmediate(next, command, -1);
  else if (["combat.modifySpeed", "combat.modifyAttackPower", "combat.modifyDefense", "combat.modifyGuard", "economy.modifyCost"].includes(command.effect)) {
    applySideOperation(targetSide(next, command.target), command, -1);
  }
}

function cloneRuntimeState(state: FamilyRuntimeState): FamilyRuntimeState {
  return {
    ...state,
    self: { ...state.self },
    opponent: { ...state.opponent },
    statuses: [...state.statuses],
    pendingChoices: [...state.pendingChoices],
    restrictions: [...state.restrictions],
    notes: [...state.notes],
  };
}

export function expireRuntimeStatuses(state: FamilyRuntimeState, duration: RuntimeDuration) {
  const next = cloneRuntimeState(state);
  const expiring = next.statuses.filter((status) => status.duration === duration);
  for (const status of expiring) revertStatus(next, status);
  next.statuses = next.statuses.filter((status) => status.duration !== duration);
  const activeRestrictions = new Set(next.statuses.map((status) => String(status.qualifier?.restriction ?? "")).filter(Boolean));
  next.restrictions = next.restrictions.filter((restriction) => activeRestrictions.has(restriction) || restriction.includes("."));
  return next;
}

/**
 * Removes one-shot delayed statuses at the gameplay event that consumes them and
 * returns the exact structured statuses to the caller. The caller applies their
 * amount to that event's Attack/Defense/damage calculation, so the modifier can
 * never leak into later events.
 */
export function takeRuntimeStatuses(
  state: FamilyRuntimeState,
  duration: RuntimeDuration,
  predicate: (status: RuntimeStatus) => boolean = () => true,
) {
  const next = cloneRuntimeState(state);
  const consumed = next.statuses.filter((status) => status.duration === duration && predicate(status));
  for (const status of consumed) revertStatus(next, status);
  const consumedIds = new Set(consumed.map((status) => status.sourceEffectId));
  next.statuses = next.statuses.filter((status) => !consumedIds.has(status.sourceEffectId));
  const activeRestrictions = new Set(next.statuses.map((status) => String(status.qualifier?.restriction ?? "")).filter(Boolean));
  next.restrictions = next.restrictions.filter((restriction) => activeRestrictions.has(restriction) || restriction.includes("."));
  return { state: next, consumed };
}

export function runtimeStatusAmount(
  state: FamilyRuntimeState,
  duration: RuntimeDuration,
  effect: string,
  target: RuntimeTarget = "self",
) {
  return state.statuses
    .filter((status) => status.duration === duration && status.effect === effect && status.target === target)
    .reduce((total, status) => total + status.amount, 0);
}

export function consumeRuntimeStatus(state: FamilyRuntimeState, sourceEffectId: string) {
  const status = state.statuses.find((candidate) => candidate.sourceEffectId === sourceEffectId);
  if (!status) return state;
  const next = cloneRuntimeState(state);
  revertStatus(next, status);
  next.statuses = next.statuses.filter((candidate) => candidate.sourceEffectId !== sourceEffectId);
  return next;
}
