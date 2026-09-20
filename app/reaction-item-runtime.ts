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
  deck?: string[];
  discard?: string[];
  destroyed?: string[];
  stage3cStatuses?: RuntimeStatus[];
  stage3cRestrictions?: string[];
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
  "reaction.preserveMarketDiscount",
  "reaction.outOfTurnConsumableShield",
  "reaction.cancelComboPayoff",
  "reaction.preventForcedDiscard",
  "reaction.forceAttackerDrawDiscardBeforeDefense",
  "reaction.defenseBeltExamCredit",
  "reaction.reversalOrDefenseFollowup",
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

function commandForReactionEffect(effect: StructuredRuntimeEffect): RuntimeCommand[] {
  if (!isReactionItemResolverSupported(effect.resolver)) return [];
  const command = runtimeCommand(effect);
  switch (effect.resolver) {
    case "reaction.reduceDeclaredAttackPower":
      return [{
        ...command,
        effect: "combat.modifyAttackPower",
        qualifier: { appliesTo: "declaredIncomingAttack" },
      }];
    case "reaction.secondNormalAttackPenaltyAndInitiateDraw":
      return [{
        ...command,
        effect: "combat.modifyAttackPower",
        qualifier: {
          appliesTo: "declaredIncomingAttack",
          drawAtNextInitiateIfIncomingHit: true,
        },
      }];
    case "reaction.preventIncomingDamage":
      return [{
        ...command,
        effect: "combat.preventDamage",
        duration: "nextDamage",
        qualifier: {
          source: "Attack",
          ...(command.amount === 0 ? { setDamageToZero: true } : {}),
        },
      }];
    case "reaction.defenseAgainstIncomingAttack":
      return [{
        ...command,
        effect: "combat.modifyDefense",
        duration: "nextIncomingAttack",
        qualifier: { appliesTo: "declaredIncomingAttack" },
      }];
    case "reaction.preserveMarketDiscount":
      return [{
        ...command,
        effect: "core.custom",
        duration: "nextPurchase",
        qualifier: { reactionEvent: "preserveMarketDiscount" },
      }];
    case "reaction.outOfTurnConsumableShield":
      return [
        { ...command, effect: "core.gainFocus", amount: 1, duration: "immediate" },
        {
          ...command,
          sourceEffectId: `${command.sourceEffectId}:damage-prevention`,
          effect: "combat.preventDamage",
          amount: 1,
          duration: "nextDamage",
          qualifier: { source: "Attack", reactionEvent: "outOfTurnConsumableShield" },
        },
      ];
    case "reaction.cancelComboPayoff":
      return [{
        ...command,
        effect: "core.custom",
        qualifier: { reactionEvent: "cancelComboPayoff" },
      }];
    case "reaction.preventForcedDiscard":
      return [{
        ...command,
        effect: "core.custom",
        duration: "endOfRound",
        qualifier: { reactionEvent: "preventForcedDiscard" },
      }];
    case "reaction.forceAttackerDrawDiscardBeforeDefense":
      return [{
        ...command,
        effect: "core.custom",
        qualifier: { reactionEvent: "forceAttackerDrawDiscardBeforeDefense", draw: 1, discard: 1 },
      }];
    case "reaction.defenseBeltExamCredit":
      return [{
        ...command,
        effect: "core.custom",
        qualifier: { reactionEvent: "defenseBeltExamCredit" },
      }];
    case "reaction.reversalOrDefenseFollowup":
      return [{
        ...command,
        effect: "core.custom",
        duration: "nextAttack",
        qualifier: { reactionEvent: "reversalOrDefenseFollowup" },
      }];
    default:
      return [];
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
    .flatMap(commandForReactionEffect);
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
    target: command.target ?? "self",
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

function addRestriction<Board extends ReactionItemBoard>(board: Board, restriction: string): Board {
  return {
    ...board,
    stage3cRestrictions: [...new Set([...(board.stage3cRestrictions ?? []), restriction])],
  };
}

function drawOne<Board extends ReactionItemBoard>(board: Board): Board {
  if (!board.deck?.length) return board;
  const cardId = board.deck[board.deck.length - 1];
  return { ...board, deck: board.deck.slice(0, -1), hand: [...board.hand, cardId] };
}

function discardOne<Board extends ReactionItemBoard>(board: Board): Board {
  if (!board.hand.length) return board;
  const cardId = board.hand[0];
  return { ...board, hand: board.hand.slice(1), discard: [...(board.discard ?? []), cardId] };
}

function applyEventCommand<Board extends ReactionItemBoard>(
  self: Board,
  opponent: Board,
  command: RuntimeCommand,
) {
  let nextSelf = self;
  let nextOpponent = opponent;
  const targetIsOpponent = command.target === "opponent";
  if (command.effect === "core.gainFocus") {
    nextSelf = { ...nextSelf, focus: (Number((nextSelf as Board & { focus?: number }).focus ?? 0) + command.amount) };
  } else if (
    command.effect === "combat.preventDamage" ||
    command.duration !== "immediate" ||
    (command.effect === "core.custom" &&
      command.qualifier?.reactionEvent !== "forceAttackerDrawDiscardBeforeDefense" &&
      command.qualifier?.reactionEvent !== "cancelComboPayoff")
  ) {
    const status = statusFromCommand(command);
    if (targetIsOpponent) nextOpponent = addStatus(nextOpponent, status);
    else nextSelf = addStatus(nextSelf, status);
  }
  if (command.qualifier?.reactionEvent === "forceAttackerDrawDiscardBeforeDefense") {
    nextOpponent = drawOne(nextOpponent);
    nextOpponent = discardOne(nextOpponent);
  }
  if (command.qualifier?.reactionEvent === "cancelComboPayoff") {
    nextOpponent = addRestriction(nextOpponent, "reaction.cancelComboPayoff");
  }
  return { self: nextSelf, opponent: nextOpponent };
}

export type ReactionItemEventApplication<Board extends ReactionItemBoard> = {
  self: Board;
  opponent: Board;
  commands: RuntimeCommand[];
  notes: string[];
  applied: boolean;
};

/** Applies a structured Reaction Item at any event window, not only an incoming Attack. */
export function resolveQuickDuelReactionItemEvent<Board extends ReactionItemBoard>(args: {
  card: ReactionItemRuntimeCard;
  self: Board;
  opponent: Board;
  trigger: RuntimeTrigger | string;
  context: ReactionItemRuntimeContext;
}) : ReactionItemEventApplication<Board> {
  const commands = reactionItemRuntimeCommands(args.card, args.trigger, args.context);
  if (!commands.length || !args.self.hand.includes(args.card.id)) {
    return { self: args.self, opponent: args.opponent, commands, notes: [], applied: false };
  }
  let self = args.self;
  let opponent = args.opponent;
  const notes: string[] = [];
  for (const command of commands) {
    const applied = applyEventCommand(self, opponent, command);
    self = applied.self;
    opponent = applied.opponent;
    if (command.qualifier?.reactionEvent === "forceAttackerDrawDiscardBeforeDefense") notes.push("attacker draws 1, then discards 1 before Defense");
    if (command.qualifier?.reactionEvent === "cancelComboPayoff") notes.push("opponent's Combo Payoff is cancelled");
    if (command.qualifier?.reactionEvent === "defenseBeltExamCredit") notes.push("this Reaction may satisfy one legal Belt Exam Defense requirement");
    if (command.qualifier?.reactionEvent === "reversalOrDefenseFollowup") notes.push("Reversal follow-up armed");
  }
  self = { ...self, hand: removeOne(self.hand, args.card.id), destroyed: [...(self.destroyed ?? []), args.card.id] };
  return { self, opponent, commands, notes, applied: true };
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
  let opponent = args.opponent;
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
    if (command.qualifier?.reactionEvent === "forceAttackerDrawDiscardBeforeDefense") {
      const applied = applyEventCommand(self, opponent, command);
      self = applied.self;
      opponent = applied.opponent;
      notes.push("attacker draws 1, then discards 1 before Defense");
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
  return { self, opponent, strike, commands, notes, applied: true };
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
export function aiReactionItemScore(card: ReactionItemRuntimeCard, context: ReactionItemRuntimeContext = {}, trigger: RuntimeTrigger | string = "onAttackDeclared") {
  const commands = reactionItemRuntimeCommands(card, trigger, context);
  if (!commands.length) return Number.NEGATIVE_INFINITY;
  return commands.reduce((score, command) => {
    if (command.effect === "combat.modifyAttackPower") return score + Math.max(0, -command.amount) * 8;
    if (command.effect === "combat.modifyDefense") return score + Math.max(0, command.amount) * 7;
    if (command.effect === "combat.preventDamage") return score + (command.qualifier?.setDamageToZero ? 60 : Math.max(0, command.amount) * 10);
    if (command.qualifier?.reactionEvent === "forceAttackerDrawDiscardBeforeDefense") return score + 12;
    if (command.qualifier?.reactionEvent === "defenseBeltExamCredit") return score + 8;
    return score;
  }, 0);
}

export function chooseAiReactionItem(cards: ReactionItemRuntimeCard[], context: ReactionItemRuntimeContext = {}, trigger: RuntimeTrigger | string = "onAttackDeclared") {
  return [...cards]
    .map((card) => ({ card, score: aiReactionItemScore(card, context, trigger) }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((left, right) => right.score - left.score || String(left.card.catalogId ?? left.card.id).localeCompare(String(right.card.catalogId ?? right.card.id)))[0]?.card ?? null;
}
