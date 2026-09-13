import assert from "node:assert/strict";
import test from "node:test";

import { applyQuickDuelPlaytestTransition } from "../app/quick-duel-playtest-host.ts";

const attack = (id, zone = "High", tags = []) => ({
  id,
  name: id,
  cardType: "Technique",
  subtype: "Attack",
  tags,
  zone,
});

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

const lookupWith = (...cards) => {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return (id) => byId.get(id) ?? null;
};

function resolvedPlayerHit(previous, strike, zone = "Low", damage = 2, overrides = {}) {
  return {
    ...previous,
    player: {
      ...previous.player,
      attacksThisTurn: previous.player.attacksThisTurn + 1,
      cardsThisTurn: [...previous.player.cardsThisTurn, strike.id],
      zonesPlayed: [...previous.player.zonesPlayed, zone],
      damageDealt: previous.player.damageDealt + damage,
    },
    ai: {
      ...previous.ai,
      hp: Math.max(0, previous.ai.hp - damage),
      damageTaken: previous.ai.damageTaken + damage,
    },
    lastExchange: {
      id: overrides.id ?? "exchange-1",
      actor: "player",
      target: "ai",
      attackCardId: strike.id,
      defenseCardId: null,
      zone,
      attackPower: overrides.attackPower ?? 4,
      defensePower: overrides.defensePower ?? 2,
      damage,
      outcome: "hit",
    },
    ...overrides.match,
  };
}

test("new Hit exchanges publish Character runtime facts exactly once", () => {
  const strike = attack("changed-zone-strike", "High");
  const previous = match(
    board({ fighterId: "DDB-CHR-CORE-002", belt: 3, focus: 0 }),
    board({ fighterId: "DDB-CHR-CORE-001" }),
  );
  const next = resolvedPlayerHit(previous, strike, "Low", 2);

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(strike));
  assert.equal(hosted.player.focus, 1, "Baron von Backflip green Hit reward should observe the changed zone");

  const repeated = applyQuickDuelPlaytestTransition(hosted, { ...hosted }, lookupWith(strike));
  assert.equal(repeated.player.focus, 1, "the same lastExchange id must not publish twice");
});

test("Hit runtime damage mutations project back onto live Quick Duel HP and damage totals", () => {
  const strike = attack("catch-up-strike", "Mid");
  const previous = match(
    board({ fighterId: "DDB-CHR-CORE-011", xp: 0, damageDealt: 0 }),
    board({ fighterId: "DDB-CHR-CORE-001", xp: 5, hp: 10, damageTaken: 0 }),
  );
  const next = resolvedPlayerHit(previous, strike, "Mid", 2);

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(strike));
  assert.equal(hosted.ai.hp, 7, "El Pollo Rojo catch-up Hit should add one canonical damage");
  assert.equal(hosted.ai.damageTaken, 3);
  assert.equal(hosted.player.damageDealt, 3);
});

test("player Character Hit choices defer behind an existing card decision and surface afterward", () => {
  const strike = attack("punchline-strike", "Mid");
  const previous = match(
    board({
      fighterId: "DDB-CHR-CORE-028",
      belt: 3,
      characterMarks: { "turn:conditionalAttack": true },
    }),
    board({ fighterId: "DDB-CHR-CORE-001" }),
  );
  const existingChoice = { kind: "attack-option", sourceCardId: strike.id, effect: "courtesy-notice" };
  const next = resolvedPlayerHit(previous, strike, "Mid", 2, { match: { pendingChoice: existingChoice } });

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(strike));
  assert.deepEqual(hosted.pendingChoice, existingChoice, "the already-open card choice keeps priority");
  assert.equal(hosted.player.characterMarks["structuredHost.deferredCharacterChoice"]?.kind, "character-runtime");

  const surfaced = applyQuickDuelPlaytestTransition(hosted, { ...hosted, pendingChoice: null }, lookupWith(strike));
  assert.equal(surfaced.pendingChoice?.kind, "character-runtime");
  assert.equal(surfaced.pendingChoice?.choice?.resolver, "character.green.linkedAttackHitRewardChoice");
  assert.equal(surfaced.player.characterMarks["structuredHost.deferredCharacterChoice"], undefined);
});
