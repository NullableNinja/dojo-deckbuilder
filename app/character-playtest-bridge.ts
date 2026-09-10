import {
  applyCharacterRuntimeEvent,
  characterAllowedAttackZones,
  characterAttackModifier,
  characterCanEquip,
  characterDamageReduction,
  characterPurchasePrice,
  resetCharacterRound,
  resetCharacterTurn,
  type CharacterRuntimeActor,
  type CharacterRuntimeBoard,
  type CharacterRuntimeCard,
  type CharacterRuntimeEvent,
  type CharacterRuntimeResult,
} from "./character-runtime.ts";

/**
 * Thin Quick Duel boundary for Character structured effects.
 *
 * The UI host supplies ordinary game facts (fighter id, cards, attack facts,
 * lifecycle events). Character IDs and printed rules stay inside canonical
 * structured data + character-runtime.ts, never in this adapter.
 */
export function resolveCharacterHostEvent(
  self: CharacterRuntimeBoard,
  opponent: CharacterRuntimeBoard,
  event: CharacterRuntimeEvent,
  actor: CharacterRuntimeActor,
): CharacterRuntimeResult {
  return applyCharacterRuntimeEvent(self, opponent, event, actor);
}

export function characterHostAttackZones(
  board: CharacterRuntimeBoard,
  card: CharacterRuntimeCard,
  printedZones: string[],
) {
  return characterAllowedAttackZones(board, card, printedZones);
}

export function characterHostAttackModifier(
  board: CharacterRuntimeBoard,
  opponent: CharacterRuntimeBoard,
  card: CharacterRuntimeCard,
  event: Partial<CharacterRuntimeEvent> = {},
) {
  return characterAttackModifier(board, opponent, card, event);
}

export function characterHostDamageReduction(board: CharacterRuntimeBoard, damage: number) {
  return characterDamageReduction(board, damage);
}

export function characterHostPurchasePrice(board: CharacterRuntimeBoard, price: number) {
  return characterPurchasePrice(board, price);
}

export function characterHostCanEquip(board: CharacterRuntimeBoard, card: CharacterRuntimeCard) {
  return characterCanEquip(board, card);
}

export function resetCharacterHostTurn<T extends CharacterRuntimeBoard>(board: T) {
  return resetCharacterTurn(board) as T;
}

export function resetCharacterHostRound<T extends CharacterRuntimeBoard>(board: T) {
  return resetCharacterRound(board) as T;
}
