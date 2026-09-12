import cardsJson from "./data/cards.json";
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

type RuntimeCard = {
  id: string;
  subtype?: string | null;
};

type RuntimeCardCatalog = { cards?: RuntimeCard[] };

const runtimeCards = (cardsJson as unknown as RuntimeCardCatalog).cards ?? [];
const cardById = new Map(runtimeCards.map((card) => [card.id, card]));

const isPermanentEquipment = (id: string) => {
  const subtype = cardById.get(id)?.subtype;
  return subtype === "Weapon" || subtype === "Defense Equipment" || subtype === "Gear";
};

const isConsumable = (id: string) => cardById.get(id)?.subtype === "Consumable";
const isWeapon = (id: string) => cardById.get(id)?.subtype === "Weapon";

/**
 * Derives Character event facts from live board state based on resolver
 * capability rather than fighter identity. This is the seam that lets canonical
 * Character effects participate in Quick Duel without card-name conditionals in
 * playtest.tsx.
 */
export function quickDuelCharacterLifecycleEvent(
  board: CharacterRuntimeBoard,
  event: "initiate" | "hide",
  facts: QuickDuelCharacterLifecycleFacts = {},
): CharacterRuntimeEvent {
  if (event === "hide") return { type: "hide" };

  let candidateIds: string[] | undefined;
  if (characterHasResolver(board.fighterId, "character.equipDiscardPermanentUntilHide")) {
    candidateIds = board.discard.filter(isPermanentEquipment);
  } else if (characterHasResolver(board.fighterId, "character.revealConsumableCycle")) {
    candidateIds = board.hand.filter(isConsumable);
  }

  return {
    type: "initiate",
    candidateIds,
    hasWeaponEquipped: board.equipment.some(isWeapon),
    noCombatDamagePreviousTurn: facts.noCombatDamagePreviousTurn,
  };
}
