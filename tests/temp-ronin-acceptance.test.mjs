import assert from "node:assert/strict";
import test from "node:test";

import { applyQuickDuelPlaytestTransition } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-001",
    belt: 3,
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
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
    learnedCombos: [],
    triggeredCombos: [],
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
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    damageDealt: 0,
    damageTaken: 0,
    completedBeltExamThisRound: false,
    ...overrides,
  };
}

function match() {
  return {
    schema: 8,
    player: board({ fighterId: "DDB-CHR-CORE-029" }),
    ai: board(),
    market: [],
    round: 1,
    phase: "player-initiate",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    locationId: "location-a",
    pendingChoice: null,
    winner: null,
    log: [],
  };
}

test("Ronin Reroll receives a once-per-game replacement choice after a Location reveal", () => {
  const previous = match();
  const hosted = applyQuickDuelPlaytestTransition(previous, { ...previous, locationId: "location-b" }, () => null);
  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type, "sceneChange");
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.revealReplacementOnceGame");
});
