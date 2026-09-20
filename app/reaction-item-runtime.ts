import {
  conditionsMatch,
  runtimeCommand,
  structuredRuntimeEffects,
  type RuntimeCardLike,
  type RuntimeCommand,
  type RuntimeStatus,
  type RuntimeTrigger,
  type StructuredRuntimeEffect,
} from "./family-effect-runtime.ts";

/**
 * The canonical Reaction Item interpreter.  It owns resolver semantics and
 * timing eligibility; callers only provide event facts and project the generic
 * plan onto their own board/match shape.
 */
export type ReactionItemRuntimeContext = {
  [key: string]: unknown;
  incomingAttackTargetsSelf?: boolean;
  incomingZones?: string[];
  attackNumber?: number;
  currentAttackIsNormal?: boolean;
  defenseOutsideTurn?: boolean;
  sameOpponentAsBlockedAttack?: boolean;
  forcedDiscardEvent?: boolean;
};

export type ReactionItemRuntimeCard = RuntimeCardLike & {
  id: string;
  timing?: string | null;
};

export type ReactionItemBoard = {
  hand: string[];
  destroyed?: string[];
  stage3cStatuses?: RuntimeStatus[];
};

export type ReactionItemStrike = {
  attackPower: number;
  zone: string;
};

export type ReactionItemApplication<Board extends ReactionItemBoard> = {
  self: Board;
  opponent: Board;
  strike: ReactionItemStrike;
  commands: RuntimeCommand[];
  notes: string[];
  applied: boolean;
};

const REACTION_RESOLVERS = new Set([
  "reaction.reduceDeclaredAttackPower",
  "reaction.preventIncomingDamage",
  "reaction.defenseAgainstIncomingAttack",
  "reaction.secondNormalAttackPenaltyAndInitiateDraw",
]);

export function isReactionItemResolverSupported(resolver?: string) {
  return Boolean(resolver && REACTION_RESOLVERS.has(resolver));
}

function conditionValues(context: ReactionItemRuntimeContext) {
  return {
    ...context,
    incomingAttackTargetsSelf: Boolean(context.incomingAttackTargetsSelf),
    incomingZones: context.incomingZones ?? [],
    attackNumber: Number(context.attackNumber ?? 0),
    currentAttackIsNormal: context.currentAttackIsNormal !== false,
    defenseOutsideTurn: Boolean(context.defenseOutsideTurn),
    sameOpponentAsBlockedAttack: Boolean(context.sameOpponentAsBlockedAttack),
    forcedDiscardEvent: Boolean(context.forcedDiscardEvent),
  };
}

function commandForReactionEffect(effect: StructuredRuntimeEffect): RuntimeCommand | null {
  if (!isReactionItemResolverSupported(effect.resolver)) return null;
  const command = runtimeCommand(effect);
  switch (effect.resolver) {
    case "reaction.reduceDeclaredAttackPower":
      return {
        ...command,
        effect: "combat.modifyAttackPower",
        qualifier: { appliesTo: "declaredIncomingAttack" },
      };
    case "reaction.secondNormalAttackPenaltyAndInitiateDraw":
      return {
        ...command,
        effect: "combat.modifyAttackPower",
        qualifier: {
          appliesTo: "declaredIncomingAttack",
          drawAtNextInitiateIfIncomingHit: true,
        },
      };
    case "reaction.preventIncomingDamage":
      return {
        ...command,
        effect: "combat.preventDamage",
        duration: "nextDamage",
        qualifier: {
          source: "Attack",
          ...(command.amount === 0 ? { setDamageToZero: true } : {}),
        },
      };
    case "reaction.defenseAgainstIncomingAttack":
      return {
        ...command,
        effect: "combat.modifyDefense",
        duration: "nextIncomingAttack",
        qualifier: { appliesTo: "declaredIncomingAttack" },
      };
    default:
      return null;
  }
}

/** Returns only commands whose trigger and canonical conditions are true. */
export function reactionItemRuntimeCommands(
  card: RuntimeCardLike | string,
  trigger: RuntimeTrigger | string,
  context: ReactionItemRuntimeContext = {},
) {
  const values = conditionValues(context);
  return structuredRuntimeEffects(card)
    .filter((effect) => effect.trigger === trigger && conditionsMatch(effect, values))
    .map(commandForReactionEffect)
    .filter((command): command is RuntimeCommand => Boolean(command));
}

export function canPlayCoreReactionItem(
  card: ReactionItemRuntimeCard,
  trigger: RuntimeTrigger | string,
  context: ReactionItemRuntimeContext = {},
) {
  return String(card.timing ?? "").trim().toLocaleLowerCase() === "reaction"
    && reactionItemRuntimeCommands(card, trigger, context).length > 0;
}

function removeOne(items: string[], id: string) {
  const index = items.indexOf(id);
  return index < 0 ? items : [...items.slice(0, index), ...items.slice(index + 1)];
}

function statusFromCommand(command: RuntimeCommand): RuntimeStatus {
  return {
    sourceEffectId: command.sourceEffectId,
    effect: command.effect,
    target: "self",
    amount: command.amount,
    duration: command.duration,
    resolver: command.resolver,
    qualifier: command.qualifier,
    appliedImmediately: false,
  };
}

function addStatus<Board extends ReactionItemBoard>(board: Board, status: RuntimeStatus): Board {
  return {
    ...board,
    stage3cStatuses: [
      ...(board.stage3cStatuses ?? []).filter((entry) => entry.sourceEffectId !== status.sourceEffectId),
      status,
    ],
  };
}

/**
 * Applies an eligible Reaction Item to a declared incoming Attack.  The host
 * deliberately destroys the source generically: individual card records do
 * not need to duplicate one-shot lifecycle text.
 */
export function resolveQuickDuelReactionItem<Board extends ReactionItemBoard>(args: {
  card: ReactionItemRuntimeCard;
  self: Board;
  opponent: Board;
  strike: ReactionItemStrike;
  trigger: RuntimeTrigger | string;
  context: ReactionItemRuntimeContext;
}): ReactionItemApplication<Board> {
  const commands = reactionItemRuntimeCommands(args.card, args.trigger, args.context);
  if (!commands.length || !args.self.hand.includes(args.card.id)) {
    return { self: args.self, opponent: args.opponent, strike: args.strike, commands, notes: [], applied: false };
  }

  let strike = { ...args.strike };
  let self = args.self;
  const notes: string[] = [];
  for (const command of commands) {
    if (command.effect === "combat.modifyAttackPower" && command.qualifier?.appliesTo === "declaredIncomingAttack") {
      const before = strike.attackPower;
      strike = { ...strike, attackPower: Math.max(0, strike.attackPower + command.amount) };
      notes.push(`declared Attack Power ${before} → ${strike.attackPower}`);
      if (command.qualifier?.drawAtNextInitiateIfIncomingHit === true) {
        self = addStatus(self, {
          sourceEffectId: `${command.sourceEffectId}:incoming-hit-draw`,
          effect: "core.draw",
          target: "self",
          amount: 1,
          duration: "nextInitiate",
          resolver: command.resolver,
          qualifier: { activateAt: "reaction.incomingAttackHit" },
          appliedImmediately: false,
        });
        notes.push("draw 1 at next Initiate if this Attack hits");
      }
      continue;
    }
    if (command.effect === "combat.modifyDefense" || command.effect === "combat.preventDamage") {
      const status = statusFromCommand(command);
      self = addStatus(self, status);
      notes.push(command.effect === "combat.modifyDefense"
        ? `+${command.amount} DEF against this Attack`
        : command.qualifier?.setDamageToZero ? "this Attack deals 0 damage" : `prevent ${command.amount} damage from this Attack`);
    }
  }
  self = {
    ...self,
    hand: removeOne(self.hand, args.card.id),
    destroyed: [...(self.destroyed ?? []), args.card.id],
  };
  return { self, opponent: args.opponent, strike, commands, notes, applied: true };
}

/** Resolves conditional Reaction Item watchers after the declared Attack ends. */
export function resolveReactionItemIncomingAttackOutcome<Board extends ReactionItemBoard>(board: Board, hit: boolean): Board {
  const statuses = board.stage3cStatuses ?? [];
  const watched = statuses.filter((status) => status.qualifier?.activateAt === "reaction.incomingAttackHit");
  if (!watched.length) return board;
  const watchedIds = new Set(watched.map((status) => status.sourceEffectId));
  const resolved = statuses
    .filter((status) => !watchedIds.has(status.sourceEffectId))
    .concat(hit ? watched.map((status) => ({
      ...status,
      qualifier: { ...(status.qualifier ?? {}), activateAt: "nextInitiate" },
    })) : []);
  return { ...board, stage3cStatuses: resolved };
}

/** Identity-free defensive policy shared by the computer's reaction window. */
export function aiReactionItemScore(card: ReactionItemRuntimeCard, context: ReactionItemRuntimeContext = {}) {
  const commands = reactionItemRuntimeCommands(card, "onAttackDeclared", context);
  if (!commands.length) return Number.NEGATIVE_INFINITY;
  return commands.reduce((score, command) => {
    if (command.effect === "combat.modifyAttackPower") return score + Math.max(0, -command.amount) * 8;
    if (command.effect === "combat.modifyDefense") return score + Math.max(0, command.amount) * 7;
    if (command.effect === "combat.preventDamage") return score + (command.qualifier?.setDamageToZero ? 60 : Math.max(0, command.amount) * 10);
    return score;
  }, 0);
}

export function chooseAiReactionItem(cards: ReactionItemRuntimeCard[], context: ReactionItemRuntimeContext = {}) {
  return [...cards]
    .map((card) => ({ card, score: aiReactionItemScore(card, context) }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((left, right) => right.score - left.score || String(left.card.catalogId ?? left.card.id).localeCompare(String(right.card.catalogId ?? right.card.id)))[0]?.card ?? null;
}
