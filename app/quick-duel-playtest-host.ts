import type { ComboHostCardLookup } from "./combo-host-facts.ts";
import type { ComboRuntimeCard } from "./combo-runtime.ts";
import type {
  CharacterRuntimeBoard,
  CharacterRuntimeChoice,
  CharacterRuntimeEvent,
} from "./character-runtime.ts";
import {
  quickDuelCharacterLifecycleEvent,
  type QuickDuelCharacterCardLookup,
  type QuickDuelCharacterLifecycleFacts,
} from "./quick-duel-character-event-context.ts";
import type { RuntimeCommand, RuntimeTrigger } from "./family-effect-runtime.ts";
import { runtimeCardFor } from "./runtime-card-catalog.ts";
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
  event: CharacterRuntimeEvent | null;
  choices: CharacterRuntimeChoice[];
  notes: string[];
};

export type QuickDuelPlaytestLifecycleEventResult<Match> = QuickDuelPlaytestEventResult<Match> & {
  characterEvent: CharacterRuntimeEvent | null;
  characterChoices: CharacterRuntimeChoice[];
  characterNotes: string[];
  characterPublished: boolean;
  characterConflict: boolean;
  characterReason: string;
};

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
 * Publishes a lifecycle event through the generic structured-status/Combo host
 * and the Character runtime. The default lookup is the shared generated runtime
 * card catalog, derived from canonical content/cards.json.
 */
export function publishQuickDuelPlaytestLifecycleEvent<
  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  trigger: RuntimeTrigger,
  operations: QuickDuelRuntimeCommandOperations<Board>,
  cardLookup: QuickDuelCharacterCardLookup = runtimeCardFor,
  statusEvent: QuickDuelRuntimeStatusEventFacts = {},
  characterFacts: QuickDuelCharacterLifecycleFacts = {},
): QuickDuelPlaytestLifecycleEventResult<Match> {
  const published = publishQuickDuelComboEvent<Board>(
    boardsForActor<Board, Match>(match, actor),
    trigger,
    actor,
    operations,
    statusEvent,
  );
  const structuredMatch = withActorBoards(match, actor, published.boards);
  const characterType = trigger === "onInitiate" ? "initiate" : trigger === "onHide" ? "hide" : null;

  if (!characterType) {
    return {
      match: structuredMatch,
      commands: published.commands,
      activatedComboIds: [],
      characterEvent: null,
      characterChoices: [],
      characterNotes: [],
      characterPublished: false,
      characterConflict: false,
      characterReason: "No Character lifecycle route for this trigger.",
    };
  }

  const actingBoard = actor === "player" ? structuredMatch.player : structuredMatch.ai;
  const characterEvent = quickDuelCharacterLifecycleEvent(actingBoard, characterType, cardLookup, characterFacts);
  const character = publishQuickDuelPlaytestCharacterEvent(structuredMatch, actor, characterEvent);

  return {
    match: character.match,
    commands: published.commands,
    activatedComboIds: [],
    characterEvent: character.event,
    characterChoices: character.choices,
    characterNotes: character.notes,
    characterPublished: character.published,
    characterConflict: character.conflict,
    characterReason: character.reason,
  };
}

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
      event: null,
      choices: [],
      notes: [],
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
    event: publication.result.event,
    choices: publication.result.choices,
    notes: publication.result.notes,
  };
}

/**
 * Resumes a canonical Character choice without teaching the Playtest about
 * individual resolver names. The runtime declares which event field receives
 * the selected value.
 */
export function resolveQuickDuelPlaytestCharacterChoice<
  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  event: CharacterRuntimeEvent,
  choice: CharacterRuntimeChoice,
  selection: string,
): QuickDuelPlaytestCharacterEventResult<Match> {
  const value = choice.selectionField === "optionalAccepted"
    ? selection === "accept"
    : selection;
  return publishQuickDuelPlaytestCharacterEvent(match, actor, {
    ...event,
    [choice.selectionField]: value,
  });
}

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
