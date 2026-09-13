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
    ...overrides,
  };
}

function match(player = board(), ai = board(), overrides = {}) {
  return {
    schema: 8,
    player,
    ai,
    market: [],
    round: 1,
    phase: "defense-window",
    turnOrder: ["ai", "player"],
    turnIndex: 0,
    lastExchange: null,
    pendingChoice: null,
    winner: null,
    log: [],
    ...overrides,
  };
}

const lookup = () => null;

test("new Block exchanges publish to the defender exactly once", () => {
  const previous = match(
    board({ fighterId: "DDB-CHR-CORE-001", reversalAttackBonus: 0 }),
    board({ fighterId: "DDB-CHR-CORE-011" }),
  );
  const next = {
    ...previous,
    lastExchange: {
      id: "block-1",
      actor: "ai",
      target: "player",
      attackCardId: "attack-card",
      defenseCardId: "defense-card",
      zone: "Mid",
      attackPower: 3,
      defensePower: 4,
      damage: 0,
      outcome: "block",
    },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookup);
  assert.equal(hosted.player.reversalAttackBonus, 1, "Auntie Parry should gain her canonical reversal bonus after blocking");
  assert.equal(hosted.ai.reversalAttackBonus, 0, "the attacker must not receive the defender's Character effect");

  const repeated = applyQuickDuelPlaytestTransition(hosted, { ...hosted }, lookup);
  assert.equal(repeated.player.reversalAttackBonus, 1, "the same Block exchange must not publish twice");
});
