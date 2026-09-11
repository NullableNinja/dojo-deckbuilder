import {
  publishQuickDuelCharacterEvent,
} from "./quick-duel-structured-host.ts";
import {
  quickDuelCharacterEventHasCompatibilityConflict,
} from "./quick-duel-character-migration.ts";
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

/**
 * Migration-safe Character event publication.
 *
 * While Quick Duel still calls a direct compatibility helper for a resolver,
 * the corresponding generic event is intentionally NOT sent through the full
 * Character event runtime. Publishing it in both places could apply the same
 * canonical structured effect twice.
 *
 * This guard contains no card/fighter identities and no rules. It is temporary
 * host migration policy. When the direct helper calls leave playtest.tsx, their
 * conflicts leave quick-duel-character-migration.ts and this function begins
 * publishing those events automatically.
 */
export function publishQuickDuelCharacterEventSafely<
  SelfBoard extends CharacterHostBoard,
  OpponentBoard extends CharacterHostBoard,
>(
  self: SelfBoard,
  opponent: OpponentBoard,
  event: CharacterRuntimeEvent,
  actor: CharacterRuntimeActor,
): QuickDuelCharacterPublication<SelfBoard, OpponentBoard> {
  if (quickDuelCharacterEventHasCompatibilityConflict(event.type)) {
    return {
      published: false,
      conflict: true,
      result: null,
      reason: `Character event '${event.type}' remains compatibility-owned during Quick Duel migration.`,
    };
  }
  return {
    published: true,
    conflict: false,
    result: publishQuickDuelCharacterEvent(self, opponent, event, actor),
    reason: `Character event '${event.type}' resolved through the canonical structured runtime.`,
  };
}
