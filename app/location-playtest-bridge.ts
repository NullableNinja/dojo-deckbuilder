import {
  resolveLocationEffects,
  type LocationCardLike,
  type LocationContext,
} from "./location-effect-resolvers.ts";
import {
  locationRuntimeDelta,
  locationUsageContext,
  markLocationCommandsUsed,
  resetLocationRound,
  resetLocationScene,
  resetLocationTurn,
  usedAcrossPlayersAfter,
  type LocationRuntimeDelta,
  type LocationTrackedState,
} from "./location-runtime.ts";

export type LocationHostEventContext = Omit<LocationContext, "locationEvent">;

export type LocationHostResolution<T extends LocationTrackedState> = {
  delta: LocationRuntimeDelta;
  state: T;
  usedAcrossPlayersThisRound: string[];
};

/**
 * Thin host boundary for structured Location effects.
 *
 * The play surface emits semantic events and ordinary context facts. The
 * canonical Location registry decides which effects match; the runtime turns
 * those commands into state deltas. No Location IDs, names, or printed prose
 * belong in this bridge.
 */
export function resolveLocationHostEvent<T extends LocationTrackedState>(
  card: LocationCardLike,
  state: T,
  locationEvent: string,
  context: LocationHostEventContext = {},
  usedAcrossPlayersThisRound: readonly string[] = [],
): LocationHostResolution<T> {
  const commands = resolveLocationEffects(card, {
    ...context,
    ...locationUsageContext(state, usedAcrossPlayersThisRound),
    locationEvent,
  });
  return {
    delta: locationRuntimeDelta(commands),
    state: markLocationCommandsUsed(state, commands),
    usedAcrossPlayersThisRound: usedAcrossPlayersAfter(commands, usedAcrossPlayersThisRound),
  };
}

export type LegacyAttackHostContext = {
  zone?: string;
  firstAttack?: boolean;
  attackTags?: readonly string[];
  hasWeapon?: boolean;
  equipmentTags?: readonly string[];
};

/**
 * Compatibility adapter for the current Quick Duel attack hook. It maps host
 * facts to canonical predicate names, but all gameplay semantics still come
 * from structured Location effects.
 */
export function structuredLocationAttackForHost(
  card: LocationCardLike,
  context: LegacyAttackHostContext,
) {
  const resolution = resolveLocationHostEvent(card, {}, "attack", {
    attackZone: context.zone,
    firstAttackThisTurn: Boolean(context.firstAttack),
    attackTagAny: [...(context.attackTags ?? [])],
    attackUsesEquipmentTagAny: [...(context.equipmentTags ?? [])],
    equipmentTagAny: [...(context.equipmentTags ?? [])],
    hasWeaponEquipped: Boolean(context.hasWeapon),
  });
  const { delta } = resolution;
  return {
    matched: delta.commands.length > 0,
    power: delta.attackPower,
    damage: delta.damage,
    notes: delta.commands.map((command) => {
      const amount = command.amount ? ` ${command.amount >= 0 ? "+" : ""}${command.amount}` : "";
      return `${command.effectId}${amount}`;
    }),
  };
}

export function resetLocationHostTurn<T extends LocationTrackedState>(state: T) {
  return resetLocationTurn(state);
}

export function resetLocationHostRound<T extends LocationTrackedState>(state: T) {
  return resetLocationRound(state);
}

export function resetLocationHostScene<T extends LocationTrackedState>(state: T) {
  return resetLocationScene(state);
}
