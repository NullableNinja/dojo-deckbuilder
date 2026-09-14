import assert from "node:assert/strict";
import test from "node:test";

import { resetCharacterRound } from "../app/character-runtime.ts";
import {
  commitQuickDuelCharacterPurchase,
  previewQuickDuelCharacterPurchasePrice,
} from "../app/quick-duel-character-purchase-host.ts";

function board(fighterId, overrides = {}) {
  return {
    fighterId,
    belt: 3,
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 10,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: [],
    deck: [],
    discard: [],
    destroyed: [],
    cardsBought: 0,
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    ...overrides,
  };
}

const marketCard = {
  id: "market-card",
  cardType: "Technique",
  subtype: "Attack",
  tags: [],
  zone: "High",
};

const foe = () => board("DDB-CHR-CORE-001");

test("Coupon Carl previews after composed pricing and preserves the canonical floor", () => {
  const coupon = board("DDB-CHR-CORE-006");
  assert.equal(previewQuickDuelCharacterPurchasePrice(coupon, 7), 6);
  assert.equal(previewQuickDuelCharacterPurchasePrice(coupon, 5), 4);
  assert.equal(previewQuickDuelCharacterPurchasePrice(coupon, 4), 4);
  assert.equal(previewQuickDuelCharacterPurchasePrice(coupon, 3), 3);
});

test("successful Coupon Carl purchaseAttempt consumes the round use only at commit", () => {
  const coupon = board("DDB-CHR-CORE-006");
  assert.equal(previewQuickDuelCharacterPurchasePrice(coupon, 7), 6);
  assert.deepEqual(coupon.usedCharacterEffectIdsThisRound, []);

  const committed = commitQuickDuelCharacterPurchase(coupon, foe(), marketCard, 7, "player");
  assert.equal(committed.price, 6);
  assert.equal(committed.characterDiscount, 1);
  assert.equal(committed.choices.length, 0);
  assert.equal(committed.self.usedCharacterEffectIdsThisRound.length, 1);
  assert.equal(previewQuickDuelCharacterPurchasePrice(committed.self, 7), 7, "second eligible purchase in the same round is full price");

  const nextRound = resetCharacterRound(committed.self);
  assert.equal(previewQuickDuelCharacterPurchasePrice(nextRound, 7), 6, "round reset restores Coupon Carl's discount");
});

test("ineligible purchase does not consume Coupon Carl's round use", () => {
  const coupon = board("DDB-CHR-CORE-006");
  const committed = commitQuickDuelCharacterPurchase(coupon, foe(), marketCard, 4, "player");
  assert.equal(committed.price, 4);
  assert.equal(committed.characterDiscount, 0);
  assert.deepEqual(committed.self.usedCharacterEffectIdsThisRound, []);
  assert.equal(previewQuickDuelCharacterPurchasePrice(committed.self, 5), 4);
});

test("Coupon Carl AI uses the same purchaseAttempt runtime and consumption", () => {
  const committed = commitQuickDuelCharacterPurchase(board("DDB-CHR-CORE-006"), foe(), marketCard, 6, "ai");
  assert.equal(committed.price, 5);
  assert.equal(committed.choices.length, 0);
  assert.equal(committed.self.usedCharacterEffectIdsThisRound.length, 1);
});

test("Ronin Reroll ignores ordinary purchaseAttempt without a real replacement reveal", () => {
  const ronin = board("DDB-CHR-CORE-029");
  const committed = commitQuickDuelCharacterPurchase(ronin, foe(), marketCard, 7, "player");
  assert.equal(committed.price, 7);
  assert.equal(committed.choices.length, 0);
  assert.deepEqual(committed.self.usedCharacterEffectIdsThisGame, []);
});
