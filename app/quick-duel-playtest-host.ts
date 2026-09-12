import type { ComboHostCardLookup } from "./combo-host-facts.ts";
import type { ComboRuntimeCard } from "./combo-runtime.ts";
import type { CharacterRuntimeBoard, CharacterRuntimeEvent } from "./character-runtime.ts";
import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";
import {
  applyQuickDuelStructuredTransition,
  hostQuickDuelComboEvent,
  prepareQuickDuelComboAttack,
  publishQuickDuelCharacterEventSafely,
  publishQuickDuelComboEvent,
  type QuickDuelAttackRuntimeFacts,
  type QuickDuelCharacterPublication,
  type QuickDuelComboEventFacts,
  type QuickDuelComboMatchBoard,
  type QuickDuelRuntimeCommandBoards,
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

export type QuickDuelPlaytestCharacterEventResult<Match> = {
  match: Match;
  published: boolean;
  conflict: boolean;
  reason: string;
};

function opposingActor(actor: QuickDuelPlaytestActor): QuickDuelPlaytestActor {
  return actor === "player" ? "ai" : "player";
}

function boardsForActor<Board extends QuickDuelComboMatchBoard, Match extends QuickDuelPlaytestHostMatch<Board>>(
  match: Match,
  actor: QuickDuelPlaytestActor,
): QuickDuelRuntimeCommandBoards<Board> {
  return actor === "player"
    ? { self: match.player, opponent: match.ai }
    : { self: match.ai, opponent: match.player };
}

function withActorBoards<Board extends QuickDuelComboMatchBoard, Match extends QuickDuelPlaytestHostMatch<Board>>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  boards: QuickDuelRuntimeCommandBoards<Board>,
): Match {
  return actor === "player"
    ? { ...match, player: boards.self, ai: boards.opponent }
    : { ...match, player: boards.opponent, ai: boards.self };
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
  return { ...next, ...applyQuickDuelStructuredTransition(previous, next, lookup) };
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
  const published = publishQuickDuelComboEvent<Board>(
    boardsForActor<Board, Match>(match, actor),
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
 * Publishes a Character event through the migration-safe canonical runtime.
 *
 * Events that still have a legacy compatibility helper in playtest.tsx are
 * deliberately rejected by the Character ownership registry so the same
 * structured effect cannot resolve twice. As those helpers are retired, the
 * registry automatically opens the corresponding generic event route without
 * adding fighter identities or rules to this adapter.
 */
export function publishQuickDuelPlaytestCharacterEvent<
  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  event: CharacterRuntimeEvent,
): QuickDuelPlaytestCharacterEventResult<Match> {
  const oriented = boardsForActor<Board, Match>(match, actor);
  const publication: QuickDuelCharacterPublication<Board, Board> = publishQuickDuelCharacterEventSafely(
    oriented.self,
    oriented.opponent,
    event,
    actor,
  );
  if (!publication.result) {
    return {
      match,
      published: publication.published,
      conflict: publication.conflict,
      reason: publication.reason,
    };
  }
  return {
    match: withActorBoards(match, actor, {
      self: publication.result.self,
      opponent: publication.result.opponent,
    }),
    published: publication.published,
    conflict: publication.conflict,
    reason: publication.reason,
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
  const hosted = hostQuickDuelComboEvent<Board>(
    boardsForActor<Board, Match>(match, actor),
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
  const prepared = prepareQuickDuelComboAttack<Board>(
    boardsForActor<Board, Match>(match, actor),
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