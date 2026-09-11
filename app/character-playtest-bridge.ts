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

/** Turn-boundary reset plus event publication, preserving unrelated host state. */
export function beginCharacterHostTurn<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(self: SelfBoard, opponent: OpponentBoard, actor: CharacterRuntimeActor = "player") {
  return applyCharacterEventForHost(resetCharacterTurn(self) as SelfBoard, opponent, { type: "turnStart" }, actor);
}

/** Round-boundary reset plus event publication, preserving unrelated host state. */
export function beginCharacterHostRound<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(self: SelfBoard, opponent: OpponentBoard, actor: CharacterRuntimeActor = "player") {
  return applyCharacterEventForHost(resetCharacterRound(self) as SelfBoard, opponent, { type: "roundStart" }, actor);
}

/** Turn-boundary cleanup remains available when the host resets before pairing boards. */
export function resetCharacterHostTurn<Board extends CharacterHostBoard>(board: Board): Board {
  return resetCharacterTurn(board) as Board;
}

/** Round-boundary cleanup remains available when the host resets before pairing boards. */
export function resetCharacterHostRound<Board extends CharacterHostBoard>(board: Board): Board {
  return resetCharacterRound(board) as Board;
}

/**
 * Canonical event subscription inventory for certification and host wiring.
 * This is derived from the Character runtime registry, not a hand-maintained
 * fighter switch in the Playtest.
 */
export function characterHostSubscriptions() {
  return characterRuntimeCoverage().map((entry) => ({
    cardId: entry.cardId,
    events: [...entry.events] as CharacterRuntimeEventType[],
  }));
}

/**
 * Hide is included even without an ability resolver subscription because the
 * runtime returns temporary borrowed Equipment at Hide. Turn/round starts are
 * published by the lifecycle helpers above.
 */
export function requiredCharacterHostEvents(): CharacterRuntimeEventType[] {
  return [...new Set<CharacterRuntimeEventType>([
    ...characterHostSubscriptions().flatMap((entry) => entry.events),
    "hide",
    "turnStart",
    "roundStart",
  ])].sort() as CharacterRuntimeEventType[];
}
