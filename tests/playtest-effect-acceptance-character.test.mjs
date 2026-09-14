import assert from "node:assert/strict";
import test from "node:test";

import { applyQuickDuelPlaytestTransition } from "../app/quick-duel-playtest-host.ts";

const strike = {
  id: "acceptance-strike",
  name: "Acceptance Strike",
  cardType: "Technique",
  subtype: "Attack",
  tags: [],
  zone: "Mid",
};

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
    phase: "player-yell",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    pendingChoice: null,
    winner: null,
    log: [],
    ...overrides,
  };
}

function resolvedHit(previous, actor, id, damage = 2) {
  const target = actor === "player" ? "ai" : "player";
  const attacker = previous[actor];
  const defender = previous[target];
  return {
    ...previous,
    [actor]: {
      ...attacker,
      attacksThisTurn: attacker.attacksThisTurn + 1,
      cardsThisTurn: [...attacker.cardsThisTurn, strike.id],
      zonesPlayed: [...attacker.zonesPlayed, "Mid"],
      damageDealt: attacker.damageDealt + damage,
    },
    [target]: {
      ...defender,
      hp: Math.max(0, defender.hp - damage),
      damageTaken: defender.damageTaken + damage,
    },
    lastExchange: {
      id,
      actor,
      target,
      attackCardId: strike.id,
      defenseCardId: null,
      zone: "Mid",
      attackPower: 4,
      defensePower: 2,
      damage,
      outcome: "hit",
    },
  };
}

const lookup = (id) => id === strike.id ? strike : null;

test("El Pollo Rojo executes through the live Quick Duel Hit transition for player and enforces first-Hit usage", () => {
  const previous = match(
    board({ fighterId: "DDB-CHR-CORE-011", xp: 0 }),
    board({ fighterId: "DDB-CHR-CORE-001", xp: 5 }),
  );

  const first = applyQuickDuelPlaytestTransition(previous, resolvedHit(previous, "player", "acceptance-player-hit-1"), lookup);
  assert.equal(first.ai.hp, 7, "canonical catch-up Hit adds one damage to the live opponent HP");
  assert.equal(first.ai.damageTaken, 3);
  assert.equal(first.player.damageDealt, 3);
  assert.equal(first.player.usedCharacterEffectIdsThisTurn.length, 1, "the first Hit consumes the turn-scoped Character use");

  const second = applyQuickDuelPlaytestTransition(first, resolvedHit(first, "player", "acceptance-player-hit-2"), lookup);
  assert.equal(second.ai.hp, 5, "a second distinct Hit in the same turn receives no extra Character damage");
  assert.equal(second.ai.damageTaken, 5);
  assert.equal(second.player.damageDealt, 5);
  assert.equal(second.player.usedCharacterEffectIdsThisTurn.length, 1);
});

test("El Pollo Rojo AI uses the same live Hit transition and projects the same damage mutation", () => {
  const previous = match(
    board({ fighterId: "DDB-CHR-CORE-001", xp: 5 }),
    board({ fighterId: "DDB-CHR-CORE-011", xp: 0 }),
    { phase: "ai-yell", turnIndex: 1 },
  );

  const hosted = applyQuickDuelPlaytestTransition(previous, resolvedHit(previous, "ai", "acceptance-ai-hit-1"), lookup);
  assert.equal(hosted.player.hp, 7);
  assert.equal(hosted.player.damageTaken, 3);
  assert.equal(hosted.ai.damageDealt, 3);
  assert.equal(hosted.ai.usedCharacterEffectIdsThisTurn.length, 1);
  assert.equal(hosted.pendingChoice, null, "AI parity must not leak a player decision");
});
