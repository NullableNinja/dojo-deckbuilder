import {
  applyCharacterRuntimeEvent,
  characterRuntimeCoverage,
  resetCharacterRound,
  resetCharacterTurn,
  type CharacterRuntimeActor,
  type CharacterRuntimeBoard,
  type CharacterRuntimeEvent,
  type CharacterRuntimeEventType,
  type CharacterRuntimeResult,
} from "./character-runtime.ts";

export type CharacterHostBoard = CharacterRuntimeBoard & Record<string, unknown>;

export type CharacterHostResult<SelfBoard extends CharacterHostBoard, OpponentBoard extends CharacterHostBoard> =
  Omit<CharacterRuntimeResult, "self" | "opponent"> & {
    self: SelfBoard;
    opponent: OpponentBoard;
  };

/**
 * Quick Duel Character semantic boundary.
 *
 * The host publishes a game event and current board facts. The canonical
 * Character registry/runtime decides whether the fighter has an ability for
 * that event and how it resolves. The host never dispatches on Character names
 * or ability prose.
 */
export function applyCharacterEventForHost<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(
  self: SelfBoard,
  opponent: OpponentBoard,
  event: CharacterRuntimeEvent,
  actor: CharacterRuntimeActor = "player",
): CharacterHostResult<SelfBoard, OpponentBoard> {
  const result = applyCharacterRuntimeEvent(self, opponent, event, actor);
  return {
    ...result,
    self: result.self as SelfBoard,
    opponent: result.opponent as OpponentBoard,
  };
}

/** Turn-boundary cleanup remains data-model agnostic and preserves host fields. */
export function resetCharacterHostTurn<Board extends CharacterHostBoard>(board: Board): Board {
  return resetCharacterTurn(board) as Board;
}

/** Round-boundary cleanup remains data-model agnostic and preserves host fields. */
export function resetCharacterHostRound<Board extends CharacterHostBoard>(board: Board): Board {
  return resetCharacterRound(board) as Board;
}

/**
 * Canonical event subscription inventory for certification and host wiring.
 * This is derived from the Character runtime registry, not a hand-maintained
 * list in the Playtest.
 */
export function characterHostSubscriptions() {
  return characterRuntimeCoverage().map((entry) => ({
    cardId: entry.cardId,
    events: [...entry.events] as CharacterRuntimeEventType[],
  }));
}

export function requiredCharacterHostEvents(): CharacterRuntimeEventType[] {
  return [...new Set(characterHostSubscriptions().flatMap((entry) => entry.events))].sort() as CharacterRuntimeEventType[];
}
