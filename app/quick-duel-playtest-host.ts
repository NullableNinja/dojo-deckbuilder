import type { ComboHostCardLookup } from "./combo-host-facts.ts";
import type { ComboRuntimeCard } from "./combo-runtime.ts";
import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";
import {
  applyQuickDuelStructuredTransition,
  hostQuickDuelComboEvent,
  prepareQuickDuelComboAttack,
  publishQuickDuelComboEvent,
  type QuickDuelAttackRuntimeFacts,
  type QuickDuelComboEventFacts,
  type QuickDuelComboMatchBoard,
  type QuickDuelRuntimeCommandOperations,
  type QuickDuelRuntimeStatusEventFacts,
  type QuickDuelTransitionMatch,
} from "./quick-duel-game-host.ts";

export type QuickDuelPlaytestActor = "player" | "ai";

export type QuickDuelPlaytestHostMatch<Board extends QuickDuelComboMatchBoard> = QuickDuelTransitionMatch<Board>;

export type QuickDuelPlaytestEventResult<Match> = {
  match: Match;
  commands: RuntimeCommand[];
  activatedComboIds: string[];
};

export type QuickDuelPlaytestAttackResult<Match> = QuickDuelPlaytestEventResult<Match> & {
  attackFacts: QuickDuelAttackRuntimeFacts;
};

function opposingActor(actor: QuickDuelPlaytestActor): QuickDuelPlaytestActor {
  return actor === "player" ? "ai" : "player";
}

function boardsForActor<Board extends QuickDuelComboMatchBoard, Match extends QuickDuelPlaytestHostMatch<Board>>(
  match: Match,
  actor: QuickDuelPlaytestActor,
) {
  return {
    self: match[actor],
    opponent: match[opposingActor(actor)],
  };
}

function withActorBoards<Board extends QuickDuelComboMatchBoard, Match extends QuickDuelPlaytestHostMatch<Board>>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  boards: { self: Board; opponent: Board },
): Match {
  const opponent = opposingActor(actor);
  return {
    ...match,
    [actor]: boards.self,
    [opponent]: boards.opponent,
  } as Match;
}

/**
 * Records durable machine-readable host facts at the existing React state-write
 * boundary. Extra Playtest match fields are preserved verbatim.
 */
export function applyQuickDuelPlaytestTransition<
  Board extends QuickDuelComboMatchBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  previous: Match,
  next: Match,
  lookup: ComboHostCardLookup,
): Match {
  return applyQuickDuelStructuredTransition(previous, next, lookup) as Match;
}

/**
 * Publishes a lifecycle event such as Initiate without fabricating a current
 * card. This advances canonical deferred statuses and active Combo sessions.
 */
export function publishQuickDuelPlaytestLifecycleEvent<
  Board extends QuickDuelComboMatchBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  trigger: RuntimeTrigger,
  operations: QuickDuelRuntimeCommandOperations<Board>,
  statusEvent: QuickDuelRuntimeStatusEventFacts = {},
): QuickDuelPlaytestEventResult<Match> {
  const published = publishQuickDuelComboEvent(
    boardsForActor(match, actor),
    trigger,
    actor,
    operations,
    statusEvent,
  );
  return {
    match: withActorBoards(match, actor, published.boards),
    commands: published.commands,
    activatedComboIds: [],
  };
}

/**
 * Publishes a real card event and evaluates learned Combos from canonical host
 * facts. Actor orientation is handled here so React never swaps self/opponent.
 */
export function hostQuickDuelPlaytestCardEvent<
  Board extends QuickDuelComboMatchBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  card: ComboRuntimeCard,
  zone: string,
  lookup: ComboHostCardLookup,
  trigger: RuntimeTrigger,
  operations: QuickDuelRuntimeCommandOperations<Board>,
  event: QuickDuelComboEventFacts = {},
  statusEvent: QuickDuelRuntimeStatusEventFacts = {},
): QuickDuelPlaytestEventResult<Match> {
  const hosted = hostQuickDuelComboEvent(
    boardsForActor(match, actor),
    card,
    zone,
    lookup,
    trigger,
    actor,
    operations,
    event,
    statusEvent,
  );
  return {
    match: withActorBoards(match, actor, hosted.boards),
    commands: hosted.commands,
    activatedComboIds: hosted.activatedComboIds,
  };
}

/**
 * Pre-combat Attack seam for both player and AI. Persistent RuntimeCommands are
 * projected back into the ordinary boards and ephemeral combat facts (currently
 * Piercing) are returned separately for the existing combat calculation.
 */
export function prepareQuickDuelPlaytestAttack<
  Board extends QuickDuelComboMatchBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  attack: ComboRuntimeCard,
  zone: string,
  lookup: ComboHostCardLookup,
  operations: QuickDuelRuntimeCommandOperations<Board>,
  event: QuickDuelComboEventFacts = {},
  statusEvent: QuickDuelRuntimeStatusEventFacts = {},
): QuickDuelPlaytestAttackResult<Match> {
  const prepared = prepareQuickDuelComboAttack(
    boardsForActor(match, actor),
    attack,
    zone,
    lookup,
    actor,
    operations,
    event,
    statusEvent,
  );
  return {
    match: withActorBoards(match, actor, prepared.boards),
    commands: prepared.commands,
    activatedComboIds: prepared.activatedComboIds,
    attackFacts: prepared.attackFacts,
  };
}
