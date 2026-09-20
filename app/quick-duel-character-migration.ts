import { characterRuntimeCoverage, type CharacterRuntimeEventType } from "./character-runtime.ts";

/**
 * Retained as a diagnostic API for callers and certification tests. Character
 * events are now fully owned by the canonical event runtime; no Quick Duel
 * compatibility helper remains active.
 */
export type CharacterResolverOwnership = {
  resolver: string;
  owner: "event-runtime";
};

export function quickDuelCharacterResolverOwnership(): CharacterResolverOwnership[] {
  const resolvers = new Set(characterRuntimeCoverage().flatMap((entry) => entry.resolvers));
  return [...resolvers].sort().map((resolver) => ({ resolver, owner: "event-runtime" as const }));
}

export function quickDuelCompatibilityOwnedResolvers() {
  return [] as string[];
}

export function quickDuelEventRuntimeOwnedResolvers() {
  return quickDuelCharacterResolverOwnership().map((entry) => entry.resolver);
}

/** No event is compatibility-blocked after the attack declaration migration. */
export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [] as const;

export function quickDuelCharacterEventHasCompatibilityConflict(_event: CharacterRuntimeEventType) {
  return false;
}
