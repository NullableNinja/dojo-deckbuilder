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
import { characterHostSubscriptions } from "./character-playtest-bridge.ts";
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

type QuickDuelCharacterCombatBoard = CharacterRuntimeBoard & {
  damageDealt?: number;
  damageTaken?: number;
};

type QuickDuelCharacterChoiceState = {
  kind: "character-runtime";
  event: CharacterRuntimeEvent;
  choice: CharacterRuntimeChoice;
};

type QuickDuelPlaytestStateMatch<Board extends QuickDuelComboMatchBoard> = QuickDuelPlaytestHostMatch<Board> & {
  pendingChoice?: unknown | null;
  winner?: QuickDuelPlaytestActor | null;
};

type QuickDuelExchangeFacts = {
  id: string;
  actor: QuickDuelPlaytestActor;
  target: QuickDuelPlaytestActor;
  attackCardId: string;
  defenseCardId?: string | null;
  zone: string;
  outcome: "hit" | "block";
  attackPower?: number;
  defensePower?: number;
  damage?: number;
};

const DEFERRED_CHARACTER_CHOICE_MARK = "structuredHost.deferredCharacterChoice";

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

function chooseAiCharacterOption(choice: CharacterRuntimeChoice): string | null {
  const preferred = choice.options.find((option) => !["skip", "decline", "cancel"].includes(option));
  if (preferred) return preferred;
  if (choice.optional && choice.selectionField === "optionalAccepted") return "decline";
  return choice.options[0] ?? null;
}

function isCharacterChoiceState(value: unknown): value is QuickDuelCharacterChoiceState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QuickDuelCharacterChoiceState>;
  return candidate.kind === "character-runtime"
    && Boolean(candidate.event && typeof candidate.event === "object")
    && Boolean(candidate.choice && typeof candidate.choice === "object");
}

function withDeferredCharacterChoice<
  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,
  Match extends QuickDuelPlaytestStateMatch<Board>,
>(match: Match, pending: QuickDuelCharacterChoiceState | null): Match {
  const marks = { ...(match.player.characterMarks ?? {}) };
  if (pending) marks[DEFERRED_CHARACTER_CHOICE_MARK] = pending;
  else delete marks[DEFERRED_CHARACTER_CHOICE_MARK];
  return {
    ...match,
    player: { ...match.player, characterMarks: marks },
  } as Match;
}

function surfaceDeferredCharacterChoice<
  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,
  Match extends QuickDuelPlaytestStateMatch<Board>,
>(match: Match): Match {
  if (match.pendingChoice) return match;
  const deferred = match.player.characterMarks?.[DEFERRED_CHARACTER_CHOICE_MARK];
  if (!isCharacterChoiceState(deferred)) return match;
  const cleared = withDeferredCharacterChoice(match, null);
  return { ...cleared, pendingChoice: deferred } as Match;
}

function quickDuelCharacterHitEvent<Board extends QuickDuelCharacterCombatBoard>(
  previous: QuickDuelPlaytestStateMatch<Board & QuickDuelComboMatchBoard>,
  exchange: QuickDuelExchangeFacts,
  lookup: ComboHostCardLookup,
): CharacterRuntimeEvent {
  const attacker = previous[exchange.actor];
  const opponent = previous[exchange.target];
  const card = lookup(exchange.attackCardId) ?? null;
  const printedZones = String(card?.zone ?? "")
    .split(",")
    .map((zone) => zone.trim())
    .filter(Boolean);
  const printedZone = printedZones[0] ?? null;
  const previousAttackZone = attacker.zonesPlayed.at(-1) ?? null;
  const zoneWasPrinted = printedZones.some((zone) => zone.toLocaleLowerCase() === exchange.zone.toLocaleLowerCase() || zone.toLocaleLowerCase() === "any");
  const isKata = (candidate: ComboRuntimeCard | null | undefined) => String(candidate?.subtype ?? candidate?.cardType ?? "").toLocaleLowerCase() === "kata";
  const isWeapon = (candidate: ComboRuntimeCard | null | undefined) =>
    String(candidate?.subtype ?? "").toLocaleLowerCase() === "weapon"
    || (candidate?.tags ?? []).some((tag) => String(tag).toLocaleLowerCase() === "weapon");

  return {
    type: "hit",
    card,
    zone: exchange.zone,
    printedZone,
    previousAttackZone,
    attackPower: exchange.attackPower,
    damage: exchange.damage,
    opponentXp: opponent.xp,
    blocked: false,
    changedZone: printedZones.length > 0 && !zoneWasPrinted,
    firstAttackThisTurn: attacker.attacksThisTurn === 0,
    usedConsumableThisTurn: attacker.usedConsumableThisRound,
    playedKataEarlierThisTurn: attacker.cardsThisTurn.some((id) => isKata(lookup(id))),
    differentZoneFromPreviousAttack: Boolean(previousAttackZone && previousAttackZone !== exchange.zone),
    hasWeaponEquipped: attacker.equipment.some((id) => isWeapon(lookup(id))),
  };
}

function quickDuelCharacterBlockEvent(
  exchange: QuickDuelExchangeFacts,
  lookup: ComboHostCardLookup,
): CharacterRuntimeEvent {
  return {
    type: "block",
    card: exchange.defenseCardId ? lookup(exchange.defenseCardId) ?? null : null,
    zone: exchange.zone,
    attackPower: exchange.attackPower,
    damage: exchange.damage,
    blocked: true,
  };
}

function projectCharacterHitDamage<
  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,
  Match extends QuickDuelPlaytestStateMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  baseDamage: number | undefined,
  resolvedDamage: number | undefined,
): Match {
  if (!Number.isFinite(baseDamage) || !Number.isFinite(resolvedDamage) || baseDamage === resolvedDamage) return match;
  const target: QuickDuelPlaytestActor = actor === "player" ? "ai" : "player";
  const attackerBoard = match[actor];
  const targetBoard = match[target];
  const requestedDelta = Number(resolvedDamage) - Number(baseDamage);
  const nextHp = Math.max(0, Math.min(targetBoard.maxHp, targetBoard.hp - requestedDelta));
  const actualDelta = targetBoard.hp - nextHp;
  if (!actualDelta) return match;

  const nextAttacker = {
    ...attackerBoard,
    damageDealt: Number(attackerBoard.damageDealt ?? 0) + actualDelta,
  } as Board;
  const nextTarget = {
    ...targetBoard,
    hp: nextHp,
    damageTaken: Number(targetBoard.damageTaken ?? 0) + actualDelta,
  } as Board;
  const withBoards = actor === "player"
    ? { ...match, player: nextAttacker, ai: nextTarget }
    : { ...match, player: nextTarget, ai: nextAttacker };
  return {
    ...withBoards,
    winner: nextHp === 0 ? actor : match.winner,
  } as Match;
}

function publishCharacterCombatTransition<
  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,
  Match extends QuickDuelPlaytestStateMatch<Board>,
>(
  previous: Match,
  next: Match,
  lookup: ComboHostCardLookup,
): Match {
  const exchange = next.lastExchange as QuickDuelExchangeFacts | null | undefined;
  if (!exchange || exchange.id === previous.lastExchange?.id) {
    return surfaceDeferredCharacterChoice(next);
  }

  const characterActor = exchange.outcome === "hit" ? exchange.actor : exchange.target;
  const event = exchange.outcome === "hit"
    ? quickDuelCharacterHitEvent(previous, exchange, lookup)
    : quickDuelCharacterBlockEvent(exchange, lookup);
  let character = publishQuickDuelPlaytestCharacterEvent(next, characterActor, event);

  if (characterActor === "ai") {
    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {
      const choice = character.choices[0];
      const selection = chooseAiCharacterOption(choice);
      if (selection === null) break;
      character = resolveQuickDuelPlaytestCharacterChoice(
        character.match,
        characterActor,
        character.event,
        choice,
        selection,
      );
    }
  }

  let result = character.match as Match;
  if (exchange.outcome === "hit") {
    result = projectCharacterHitDamage(
      result,
      exchange.actor,
      event.damage,
      character.event?.damage,
    );
  }

  if (characterActor === "player" && character.event && character.choices.length > 0) {
    const pending: QuickDuelCharacterChoiceState = {
      kind: "character-runtime",
      event: character.event,
      choice: character.choices[0],
    };
    result = result.pendingChoice
      ? withDeferredCharacterChoice(result, pending)
      : ({ ...result, pendingChoice: pending } as Match);
  }

  return surfaceDeferredCharacterChoice(result);
}

export function applyQuickDuelPlaytestTransition<
  Board extends QuickDuelComboMatchBoard & QuickDuelCharacterCombatBoard,
  Match extends QuickDuelPlaytestStateMatch<Board>,
>(
  previous: Match,
  next: Match,
  lookup: ComboHostCardLookup,
): Match {
  const structured = { ...next, ...applyQuickDuelStructuredTransition(previous, next, lookup) } as Match;
  return publishCharacterCombatTransition(previous, structured, lookup);
}

export type QuickDuelPlaytestComboRevealResult<Match> = QuickDuelPlaytestCharacterEventResult<Match> & {
  comboOfferId: string | null;
  comboDeck: string[];
};

function characterSubscribesToEvent(board: CharacterRuntimeBoard, event: CharacterRuntimeEvent["type"]) {
  return characterHostSubscriptions().some((entry) => entry.cardId === board.fighterId && entry.events.includes(event));
}

export function commitQuickDuelPlaytestComboRevealSelection(
  comboOfferId: string | null,
  comboDeck: string[],
  event: CharacterRuntimeEvent | null,
) {
  if (!comboOfferId || event?.type !== "comboReveal" || !event.selectedId) return { comboOfferId, comboDeck };
  const revealIds = event.revealIds ?? [];
  if (revealIds.length !== 2 || !revealIds.includes(comboOfferId) || !revealIds.includes(event.selectedId)) return { comboOfferId, comboDeck };
  const extraId = revealIds.find((id) => id !== comboOfferId) ?? null;
  if (!extraId || comboDeck[0] !== extraId) return { comboOfferId, comboDeck };
  const unselectedId = event.selectedId === comboOfferId ? extraId : comboOfferId;
  return {
    comboOfferId: event.selectedId,
    comboDeck: [...comboDeck.slice(1), unselectedId],
  };
}

export function publishQuickDuelPlaytestComboReveal<
  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  actor: QuickDuelPlaytestActor,
  comboOfferId: string | null,
  comboDeck: string[],
): QuickDuelPlaytestComboRevealResult<Match> {
  const board = actor === "player" ? match.player : match.ai;
  const extraId = comboDeck[0] ?? null;
  if (!comboOfferId || !extraId || !characterSubscribesToEvent(board, "comboReveal")) {
    return {
      match, published: false, conflict: false,
      reason: !comboOfferId ? "No face-up Combo is available." : !extraId ? "No additional Combo is available to reveal." : "Character has no comboReveal subscription.",
      event: null, choices: [], notes: [], comboOfferId, comboDeck,
    };
  }

  let character = publishQuickDuelPlaytestCharacterEvent(match, actor, {
    type: "comboReveal",
    revealIds: [comboOfferId, extraId],
  });

  if (actor === "ai") {
    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {
      const choice = character.choices[0];
      const selection = chooseAiCharacterOption(choice);
      if (selection === null) break;
      character = resolveQuickDuelPlaytestCharacterChoice(character.match, actor, character.event, choice, selection);
    }
  }

  const projected = commitQuickDuelPlaytestComboRevealSelection(comboOfferId, comboDeck, character.event);
  return { ...character, ...projected };
}

/**
 * Publishes a lifecycle event through the generic structured-status/Combo host
 * and the Character runtime. The default lookup is the shared generated runtime
 * card catalog, derived from canonical content/cards.json.
 *
 * Human choices are returned to the caller for the UI to surface. AI choices
 * are resumed through the exact same Character choice contract using a small,
 * identity-free policy so an AI fighter never stalls waiting for React input.
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
  let character = publishQuickDuelPlaytestCharacterEvent(structuredMatch, actor, characterEvent);

  if (actor === "ai") {
    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {
      const choice = character.choices[0];
      const selection = chooseAiCharacterOption(choice);
      if (selection === null) break;
      character = resolveQuickDuelPlaytestCharacterChoice(
        character.match,
        actor,
        character.event,
        choice,
        selection,
      );
    }
  }

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
