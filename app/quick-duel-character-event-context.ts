import {
  characterHasResolver,
  type CharacterRuntimeBoard,
  type CharacterRuntimeEvent,
} from "./character-runtime.ts";

/**
 * Runtime facts that are not intrinsic to CharacterRuntimeBoard but are known by
 * the Quick Duel lifecycle host. Keep these mechanical facts identity-free:
 * callers provide facts about the match, never fighter names or card prose.
 */
export type QuickDuelCharacterLifecycleFacts = {
  noCombatDamagePreviousTurn?: boolean;
};

export type QuickDuelCharacterCard = {
  id: string;
  subtype?: string | null;
};

export type QuickDuelCharacterCardLookup = (id: string) => QuickDuelCharacterCard | null | undefined;

const isPermanentEquipment = (card: QuickDuelCharacterCard | null | undefined) =>
  card?.subtype === "Weapon" || card?.subtype === "Defense Equipment" || card?.subtype === "Gear";

const isConsumable = (card: QuickDuelCharacterCard | null | undefined) => card?.subtype === "Consumable";
const isWeapon = (card: QuickDuelCharacterCard | null | undefined) => card?.subtype === "Weapon";

/**
 * Derives Character event facts from live board state based on resolver
 * capability rather than fighter identity. Card classification comes from the
 * host's canonical card lookup instead of a second imported catalog.
 */
export function quickDuelCharacterLifecycleEvent(
  board: CharacterRuntimeBoard,
  event: "initiate" | "hide",
  cardLookup: QuickDuelCharacterCardLookup,
  facts: QuickDuelCharacterLifecycleFacts = {},
): CharacterRuntimeEvent {
  if (event === "hide") return { type: "hide" };

  let candidateIds: string[] | undefined;
  if (characterHasResolver(board.fighterId, "character.equipDiscardPermanentUntilHide")) {
    candidateIds = board.discard.filter((id) => isPermanentEquipment(cardLookup(id)));
  } else if (characterHasResolver(board.fighterId, "character.revealConsumableCycle")) {
    candidateIds = board.hand.filter((id) => isConsumable(cardLookup(id)));
  }

  return {
    type: "initiate",
    candidateIds,
    hasWeaponEquipped: board.equipment.some((id) => isWeapon(cardLookup(id))),
    noCombatDamagePreviousTurn: facts.noCombatDamagePreviousTurn,
  };
}
