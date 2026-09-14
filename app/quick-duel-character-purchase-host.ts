import {
  characterPurchasePrice,
  type CharacterRuntimeActor,
  type CharacterRuntimeBoard,
  type CharacterRuntimeCard,
} from "./character-runtime.ts";
import { publishQuickDuelCharacterEvent } from "./quick-duel-structured-host.ts";

/**
 * Apply Character pricing after the host has composed all non-Character Market
 * modifiers. This is a preview only: usage is consumed only when a purchase is
 * actually committed.
 */
export function previewQuickDuelCharacterPurchasePrice(
  board: CharacterRuntimeBoard,
  composedPrice: number,
) {
  return characterPurchasePrice(board, composedPrice);
}

/**
 * Publish the canonical purchaseAttempt immediately before Focus is spent and
 * the purchased card moves. The Character runtime owns usage consumption; the
 * caller owns the actual economy mutation.
 */
export function commitQuickDuelCharacterPurchase<
  SelfBoard extends CharacterRuntimeBoard,
  OpponentBoard extends CharacterRuntimeBoard,
>(
  self: SelfBoard,
  opponent: OpponentBoard,
  card: CharacterRuntimeCard,
  composedPrice: number,
  actor: CharacterRuntimeActor,
) {
  const price = previewQuickDuelCharacterPurchasePrice(self, composedPrice);
  const result = publishQuickDuelCharacterEvent(
    self,
    opponent,
    {
      type: "purchaseAttempt",
      card,
      modifierBonus: price - composedPrice,
    },
    actor,
  );
  return {
    ...result,
    price,
    characterDiscount: Math.max(0, composedPrice - price),
  };
}
