import { characterRuntimeCoverage, type CharacterRuntimeEventType } from "./character-runtime.ts";

export type CharacterCompatibilityHelper =
  | "characterAllowedAttackZones"
  | "characterAttackModifier"
  | "characterCanEquip"
  | "characterDamageReduction";

export type CharacterResolverOwnership = {
  resolver: string;
  owner: "compatibility-helper" | "event-runtime";
  helper?: CharacterCompatibilityHelper;
};

/**
 * Temporary migration ownership for the four structured Character compatibility
 * helpers still called directly by Quick Duel. These are resolver names from
 * canonical card-effects data, not fighter/card identities.
 *
 * The purpose of this inventory is to make double execution impossible to hide:
 * a resolver remains compatibility-owned until the corresponding direct helper
 * call is removed from playtest.tsx. Only then may the generic Character event
 * runtime become its sole owner.
 */
export const QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS: Readonly<
  Record<CharacterCompatibilityHelper, readonly string[]>
> = {
  characterAllowedAttackZones: [
    "character.firstSpinAttackRound",
    "character.firstHighAttackToMid",
    "character.declaredAttackZoneChange",
    "character.discardToChangeDeclaredZone",
    "character.afterAttackDifferentZone",
  ],
  characterAttackModifier: [
    "character.firstAttackAfterConsumable",
    "character.firstKickDifferentZone",
    "character.firstUnarmedAttack",
    "character.conditionalAttackPower",
    "character.green.linkedZoneChangePower",
    "character.green.linkedRecycleLowAttack",
  ],
  characterCanEquip: [
    "character.cannotEquipWeapons",
  ],
  characterDamageReduction: [
    "character.damageThreshold",
    "character.firstHitDamagePrevention",
  ],
} as const;

const compatibilityOwner = new Map<string, CharacterCompatibilityHelper>();
for (const [helper, resolvers] of Object.entries(QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS) as [CharacterCompatibilityHelper, readonly string[]][]) {
  for (const resolver of resolvers) {
    if (compatibilityOwner.has(resolver)) throw new Error(`Character resolver '${resolver}' is assigned to multiple compatibility helpers.`);
    compatibilityOwner.set(resolver, helper);
  }
}

export function quickDuelCharacterResolverOwnership(): CharacterResolverOwnership[] {
  const resolvers = new Set(characterRuntimeCoverage().flatMap((entry) => entry.resolvers));
  return [...resolvers].sort().map((resolver) => {
    const helper = compatibilityOwner.get(resolver);
    return helper
      ? { resolver, owner: "compatibility-helper" as const, helper }
      : { resolver, owner: "event-runtime" as const };
  });
}

export function quickDuelCompatibilityOwnedResolvers() {
  return [...compatibilityOwner.keys()].sort();
}

export function quickDuelEventRuntimeOwnedResolvers() {
  return quickDuelCharacterResolverOwnership()
    .filter((entry) => entry.owner === "event-runtime")
    .map((entry) => entry.resolver);
}

/**
 * Events touching a compatibility-owned resolver are not safe to publish into
 * the full Character runtime while the direct helper remains active. This is a
 * certification guard, not a replacement rules engine. The final migration
 * removes the helper call and therefore removes the conflict.
 */
export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [
  "attackDeclared",
  "damageIncoming",
  "equip",
] as const;

export function quickDuelCharacterEventHasCompatibilityConflict(event: CharacterRuntimeEventType) {
  return QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS.includes(event);
}
