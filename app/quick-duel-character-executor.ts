import {
  publishQuickDuelCharacterEvent,
} from "./quick-duel-structured-host.ts";
import type {
  CharacterHostBoard,
  CharacterHostResult,
} from "./character-playtest-bridge.ts";
import type {
  CharacterRuntimeActor,
  CharacterRuntimeEvent,
} from "./character-runtime.ts";

export type QuickDuelCharacterPublication<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
> = {
  published: boolean;
  conflict: boolean;
  result: CharacterHostResult<SelfBoard, OpponentBoard> | null;
  reason: string;
};

/** Publish every Character event through the canonical runtime. */
export function publishQuickDuelCharacterEventSafely<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(
  self: SelfBoard,
  opponent: OpponentBoard,
  event: CharacterRuntimeEvent,
  actor: CharacterRuntimeActor,
): QuickDuelCharacterPublication<SelfBoard, OpponentBoard> {
  return {
    published: true,
    conflict: false,
    result: publishQuickDuelCharacterEvent(self, opponent, event, actor),
    reason: `Character event '${event.type}' resolved through the canonical structured runtime.`,
  };
}
