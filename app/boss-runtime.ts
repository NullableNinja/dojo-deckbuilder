import {
  conditionsMatch,
  runtimeCommand,
  structuredRuntimeEffects,
  type RuntimeCardLike,
  type RuntimeCommand,
  type RuntimeCondition,
  type RuntimeStatus,
  type RuntimeTrigger,
} from "./family-effect-runtime.ts";

/**
 * Shared execution surface for the Boss Blitz module.
 *
 * Boss cards are deliberately resolved from their structured effect records.
 * The host knows event facts and projects commands onto a Boss/player state;
 * it never dispatches on a catalog ID or printed card name.
 */
export const SUPPORTED_BOSS_RESOLVERS = new Set([
  "boss.attack.hitSpeedPenalty",
  "boss.attack.blockNextPower",
  "boss.attack.hitDiscard",
  "boss.attack.hitNextAttackPenalty",
  "boss.attack.hitTempoLock",
  "boss.attack.hitDefensePenalty",
  "boss.profile.kataDefense",
  "boss.profile.zoneChangeAttackPenalty",
  "boss.profile.exhaustDiscard",
  "boss.profile.zoneSpeedPenalty",
  "boss.profile.startTurnDiscardOrPower",
  "boss.profile.equipAttackPenalty",
  "boss.profile.readyEquipmentPower",
  "boss.profile.blockSpeedPenalty",
  "boss.profile.consumableHeal",
  "boss.profile.blockDefense",
  "boss.stage.enrage",
  "boss.stage.stats",
  "boss.technique.conditionalNextAttackPower",
  "boss.technique.revealNextArsenal",
  "boss.technique.heal",
  "boss.technique.nextAttackPenalty",
  "boss.technique.nextAttackPower",
  "boss.technique.nextDefense",
  "boss.technique.nextSpeed",
  "boss.defense.guard",
]);

export function isSupportedBossResolver(resolver?: string) {
  return Boolean(resolver && SUPPORTED_BOSS_RESOLVERS.has(resolver));
}

export type BossRuntimeContext = {
  bossHp?: number;
  targetHpAtMost?: number;
  incomingZones?: string[];
  oncePerRound?: boolean;
  playerDiscarded?: boolean;
  playerDeclinedDiscard?: boolean;
  [key: string]: unknown;
};

export type BossSide = {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  hand: string[];
  discard: string[];
  statuses: RuntimeStatus[];
  restrictions: string[];
};

export type BossGuard = {
  zone: string;
  preventDamage: number;
  sourceEffectId: string;
};

export type BossRuntimeState = {
  boss: BossSide;
  player: BossSide;
  bossGuard: BossGuard | null;
  revealedArsenal: number;
  enraged: boolean;
  stageStatsApplied: boolean;
  choices: { kind: string; amount: number; fallbackAttackPower: number }[];
  notes: string[];
};

export function createBossRuntimeState(overrides: Partial<BossRuntimeState> = {}): BossRuntimeState {
  const side = (): BossSide => ({
    hp: 10,
    maxHp: 10,
    attack: 0,
    defense: 0,
    speed: 0,
    hand: [],
    discard: [],
    statuses: [],
    restrictions: [],
  });
  return {
    boss: overrides.boss ? { ...side(), ...overrides.boss } : side(),
    player: overrides.player ? { ...side(), ...overrides.player } : side(),
    bossGuard: overrides.bossGuard ?? null,
    revealedArsenal: overrides.revealedArsenal ?? 0,
    enraged: overrides.enraged ?? false,
    stageStatsApplied: overrides.stageStatsApplied ?? false,
    choices: overrides.choices ?? [],
    notes: overrides.notes ?? [],
  };
}

function conditionValues(context: BossRuntimeContext) {
  return {
    ...context,
    bossHp: Number(context.bossHp ?? 0),
    targetHpAtMost: Number(context.targetHpAtMost ?? context.bossHp ?? 0),
    incomingZones: context.incomingZones ?? [],
    oncePerRound: Boolean(context.oncePerRound),
  };
}

function bossCommand(effect: Parameters<typeof runtimeCommand>[0]): RuntimeCommand {
  const command = runtimeCommand(effect);
  if (!isSupportedBossResolver(command.resolver)) return command;
  switch (command.resolver) {
    case "boss.technique.revealNextArsenal":
      return { ...command, qualifier: { bossEvent: "revealNextArsenal" } };
    case "boss.stage.enrage":
      return { ...command, qualifier: { bossEvent: "enrage", threshold: 30 } };
    case "boss.stage.stats":
      return { ...command, qualifier: { bossEvent: "stageStats" } };
    case "boss.profile.startTurnDiscardOrPower":
      return { ...command, qualifier: { bossEvent: "startTurnDiscardOrPower", fallbackAttackPower: 1 } };
    case "boss.attack.hitTempoLock":
      return { ...command, qualifier: { bossEvent: "tempoLock" } };
    case "boss.defense.guard":
      return {
        ...command,
        qualifier: {
          bossEvent: "bossGuard",
          zone: (effect.conditions ?? []).find((condition: RuntimeCondition) => condition.kind === "incomingZones")?.value,
        },
      };
    default:
      return command;
  }
}

/** Returns the commands for a Boss card at one semantic event window. */
export function bossRuntimeCommands(card: RuntimeCardLike | string, trigger: RuntimeTrigger | string, context: BossRuntimeContext = {}) {
  const values = conditionValues(context);
  return structuredRuntimeEffects(card)
    .filter((effect) => effect.trigger === trigger && isSupportedBossResolver(effect.resolver))
    .filter((effect) => conditionsMatch(effect, values))
    .map(bossCommand);
}

function targetSide(state: BossRuntimeState, target: string) {
  return target === "opponent" ? state.player : state.boss;
}

function addStatus(side: BossSide, command: RuntimeCommand) {
  return {
    ...side,
    statuses: [...side.statuses.filter((status) => status.sourceEffectId !== command.sourceEffectId), {
      sourceEffectId: command.sourceEffectId,
      effect: command.effect,
      target: command.target,
      amount: command.amount,
      duration: command.duration,
      resolver: command.resolver,
      qualifier: command.qualifier,
      appliedImmediately: false,
    }],
  };
}

function applyCommand(state: BossRuntimeState, command: RuntimeCommand): BossRuntimeState {
  let next: BossRuntimeState = {
    ...state,
    boss: { ...state.boss },
    player: { ...state.player },
    choices: [...state.choices],
    notes: [...state.notes],
    bossGuard: state.bossGuard ? { ...state.bossGuard } : null,
  };
  const side = targetSide(next, command.target);
  const targetIsPlayer = command.target === "opponent";

  if (command.qualifier?.bossEvent === "revealNextArsenal") {
    next.revealedArsenal += Math.max(1, command.amount || 1);
    next.notes.push("revealed another Boss Arsenal card");
    return next;
  }
  if (command.qualifier?.bossEvent === "enrage") {
    next.enraged = next.boss.hp <= Number(command.qualifier.threshold ?? 30);
    next.notes.push(next.enraged ? "Final Boss is Enraged" : "Final Boss is not Enraged");
    return next;
  }
  if (command.qualifier?.bossEvent === "stageStats") {
    next.stageStatsApplied = true;
    return next;
  }
  if (command.qualifier?.bossEvent === "startTurnDiscardOrPower") {
    next.choices.push({ kind: "boss.startTurnDiscardOrPower", amount: command.amount || 1, fallbackAttackPower: Number(command.qualifier.fallbackAttackPower ?? 1) });
    return next;
  }
  if (command.qualifier?.bossEvent === "tempoLock") {
    next.player = { ...next.player, restrictions: [...new Set([...next.player.restrictions, "boss.tempoAdvantageLocked"]) ] };
    return next;
  }
  if (command.qualifier?.bossEvent === "bossGuard") {
    const zones = Array.isArray(command.qualifier.zone) ? command.qualifier.zone : [];
    next.bossGuard = { zone: String(zones[0] ?? ""), preventDamage: command.amount, sourceEffectId: command.sourceEffectId };
    return next;
  }

  if (command.effect === "core.heal") {
    const healed = { ...side, hp: Math.min(side.maxHp, side.hp + Math.max(0, command.amount)) };
    if (targetIsPlayer) next.player = healed; else next.boss = healed;
    return next;
  }
  if (command.effect === "core.discard") {
    const hand = [...side.hand];
    const discarded = hand.splice(0, Math.max(0, command.amount));
    const updated = { ...side, hand, discard: [...side.discard, ...discarded] };
    if (targetIsPlayer) next.player = updated; else next.boss = updated;
    return next;
  }
  if (command.effect === "combat.modifyAttackPower" || command.effect === "combat.modifyDefense" || command.effect === "combat.modifySpeed") {
    const stat = command.effect === "combat.modifyAttackPower" ? "attack" : command.effect === "combat.modifyDefense" ? "defense" : "speed";
    const updated = { ...side, [stat]: side[stat] + command.amount };
    const withStatus = command.duration === "immediate" ? updated : addStatus(updated, command);
    if (targetIsPlayer) next.player = withStatus; else next.boss = withStatus;
    return next;
  }
  if (command.effect === "combat.modifyGuard" || command.effect === "combat.preventDamage") {
    const updated = addStatus(side, command);
    if (targetIsPlayer) next.player = updated; else next.boss = updated;
    return next;
  }
  if (command.effect === "core.custom") {
    const updated = addStatus(side, command);
    if (targetIsPlayer) next.player = updated; else next.boss = updated;
  }
  return next;
}

/** Applies all structured effects for one Boss event through the same host for every card. */
export function resolveBossCardEvent(args: {
  card: RuntimeCardLike | string;
  trigger: RuntimeTrigger | string;
  context?: BossRuntimeContext;
  state: BossRuntimeState;
}) {
  const context = {
    ...(args.context ?? {}),
    bossHp: args.context?.bossHp ?? args.state.boss.hp,
    targetHpAtMost: args.context?.targetHpAtMost ?? args.state.boss.hp,
  };
  const commands = bossRuntimeCommands(args.card, args.trigger, context);
  let state = args.state;
  for (const command of commands) state = applyCommand(state, command);
  return { state, commands, applied: commands.length > 0 };
}
