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
    self: overrides.self ?? side(),
    opponent: overrides.opponent ?? side(),
    statuses: overrides.statuses ?? [],
    pendingChoices: overrides.pendingChoices ?? [],
    restrictions: overrides.restrictions ?? [],
    notes: overrides.notes ?? [],
  };
}

function targetSide(state: FamilyRuntimeState, target: RuntimeTarget) {
  return target === "opponent" ? state.opponent : state.self;
}

function shouldPersist(command: RuntimeCommand) {
  return command.duration !== "immediate" || [
    "combat.modifyAttackPower",
    "combat.modifyDefense",
    "combat.modifyGuard",
    "combat.modifySpeed",
    "combat.preventDamage",
    "combat.grantFlow",
    "combat.chooseZone",
    "economy.modifyCost",
  ].includes(command.effect) && ["nextAttack", "nextDefense", "endOfTurn", "endOfRound", "nextHonor", "whileEquipped"].includes(command.duration);
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
    next.statuses.push({
      sourceEffectId: command.sourceEffectId,
      effect: command.effect,
      target: command.target,
      amount: command.amount,
      duration: command.duration,
      resolver: command.resolver,
      qualifier: command.qualifier,
    });
    return next;
  }

  const side = targetSide(next, command.target);
  switch (command.effect) {
    case "core.draw": side.draw += Math.max(0, command.amount); break;
    case "core.discard": side.discard += Math.max(0, command.amount); break;
    case "core.heal": side.hp = Math.min(side.maxHp, side.hp + Math.max(0, command.amount)); break;
    case "core.gainFocus": side.focus = Math.max(0, side.focus + command.amount); break;
    case "core.gainXP": side.xp = Math.max(0, side.xp + command.amount); break;
    case "core.destroy": side.destroyed += Math.max(0, command.amount || 1); break;
    case "core.reveal": side.reveal += Math.max(0, command.amount); break;
    case "combat.modifySpeed": side.speed += command.amount; break;
    case "combat.modifyAttackPower": side.attack += command.amount; break;
    case "combat.modifyDefense": side.defense += command.amount; break;
    case "combat.modifyGuard": side.guard += command.amount; break;
    case "combat.preventDamage": side.damagePrevention += Math.max(0, command.amount); break;
    case "combat.dealDamage": side.hp = Math.max(0, side.hp - Math.max(0, command.amount)); break;
    case "combat.grantFlow": side.flow = true; break;
    case "economy.modifyCost": side.purchaseCostModifier += command.amount; break;
    case "equipment.ready": side.equipmentReady += Math.max(0, command.amount || 1); break;
    case "equipment.exhaust": side.equipmentExhausted += Math.max(0, command.amount || 1); break;
    case "core.custom":
      if (command.resolver) next.restrictions.push(command.resolver);
      break;
    default:
      next.notes.push(`Unhandled canonical effect ${command.effect} from ${command.sourceEffectId}`);
      break;
  }
  return next;
}

export function applyRuntimeCommands(state: FamilyRuntimeState, commands: RuntimeCommand[]) {
  return commands.reduce(applyRuntimeCommand, state);
}

export function expireRuntimeStatuses(state: FamilyRuntimeState, duration: RuntimeDuration) {
  return { ...state, statuses: state.statuses.filter((status) => status.duration !== duration) };
}
