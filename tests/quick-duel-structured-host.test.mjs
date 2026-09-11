import assert from "node:assert/strict";
import test from "node:test";
import { emptyComboHostFacts, recordComboHostPurchase } from "../app/combo-host-facts.ts";
import { comboPlanFromQuickDuelFacts, publishQuickDuelCharacterEvent } from "../app/quick-duel-structured-host.ts";

const weaponAttack = { id: "atk", name: "Weapon Attack", cardType: "Technique", subtype: "Attack", tags: ["Attack", "Weapon"], zone: "Mid" };
const weapon = { id: "wpn", name: "Weapon", cardType: "Item", subtype: "Weapon", tags: ["Weapon", "Blade"] };
const combo = { id: "combo", name: "Purchase Order of Pain", catalogId: "DDB-CMB-CORE-036", cardType: "Combo", subtype: "Combo", tags: [] };
const lookup = (id) => id === "wpn" ? weapon : id === "atk" ? weaponAttack : null;

function board(fighterId) {
  return {
    fighterId,
    belt: 3,
    hp: 25,
    maxHp: 25,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackAnyZone: false,
    nextAttackHasFlow: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: [],
    deck: [],
    discard: [],
    destroyed: [],
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    nextInitiateFocus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
  };
}

test("Quick Duel host builds Combo plans from generic facts rather than requirement prose", () => {
  const facts = recordComboHostPurchase(emptyComboHostFacts(), "wpn");
  const plan = comboPlanFromQuickDuelFacts(combo, facts, {
    priorCards: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
    hitZonesThisTurn: [],
    zonesPlayed: [],
    equipment: [weapon],
    currentCard: weaponAttack,
    currentZone: "Mid",
    currentAttackHit: true,
    currentDefense: null,
    currentDefenseBlocked: false,
    completedBeltExamThisRound: false,
    triggeredComboIds: [],
  }, lookup);
  assert.equal(plan.requirement.eligible, true);
  assert.deepEqual(plan.unsupportedEffectIds, []);
});

test("Quick Duel host publishes Character events through the canonical runtime", () => {
  const self = board("DDB-CHR-CORE-001");
  const opponent = board("DDB-CHR-CORE-002");
  const result = publishQuickDuelCharacterEvent(self, opponent, { type: "block", blocked: true }, "player");
  assert.equal(result.self.reversalAttackBonus, 1);
  assert.ok(result.notes.includes("character.reversalAfterBlock"));
});
