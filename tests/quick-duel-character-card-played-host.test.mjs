import assert from "node:assert/strict";
import test from "node:test";

import { applyQuickDuelPlaytestTransition } from "../app/quick-duel-playtest-host.ts";

const attack = (id, zone = "High", tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const kata = (id) => ({ id, name: id, cardType: "Technique", subtype: "Kata", tags: [], zone: null });
const consumable = (id) => ({ id, name: id, cardType: "Item", subtype: "Consumable", tags: [], zone: null });

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
    hand: ["h1", "h2"],
    deck: ["d1", "d2"],
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

test("Disco Dojo Dan receives canonical second-zone Speed and Green Flow from cardPlayed", () => {
  const first = attack("first-strike", "High");
  const second = attack("second-strike", "Mid");
  const previous = match(board({
    fighterId: "DDB-CHR-CORE-009",
    cardsThisTurn: [first.id],
    zonesPlayed: ["High"],
  }));
  const next = {
    ...previous,
    player: {
      ...previous.player,
      cardsThisTurn: [first.id, second.id],
      zonesPlayed: ["High", "Mid"],
    },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(first, second));
  assert.equal(hosted.player.tempSpeed, 1);
  assert.equal(hosted.player.nextAttackHasFlow, true);

  const repeated = applyQuickDuelPlaytestTransition(hosted, { ...hosted }, lookupWith(first, second));
  assert.equal(repeated.player.tempSpeed, 1, "unchanged cardsThisTurn must not republish cardPlayed");
});

test("Sir Kixalot tracks Kick plays across transitions and arms Flow on the second Kick", () => {
  const first = attack("kick-one", "High", ["Kick"]);
  const second = attack("kick-two", "Low", ["Kick"]);
  const initial = match(board({ fighterId: "DDB-CHR-CORE-032" }));
  const firstState = applyQuickDuelPlaytestTransition(initial, {
    ...initial,
    player: { ...initial.player, cardsThisTurn: [first.id], zonesPlayed: ["High"] },
  }, lookupWith(first, second));
  assert.equal(firstState.player.nextAttackHasFlow, false);
  assert.equal(firstState.player.characterMarks["turn:kickCount"], 1);

  const secondState = applyQuickDuelPlaytestTransition(firstState, {
    ...firstState,
    player: { ...firstState.player, cardsThisTurn: [first.id, second.id], zonesPlayed: ["High", "Low"] },
  }, lookupWith(first, second));
  assert.equal(secondState.player.nextAttackHasFlow, true);
  assert.equal(secondState.player.characterMarks["turn:kickCount"], 2);
});

test("The Belt Collector receives the cardPlayed exam-completion Speed reward from structured board state", () => {
  const strike = attack("exam-strike", "Mid");
  const previous = match(board({ fighterId: "DDB-CHR-CORE-034", completedBeltExamThisRound: false }));
  const next = {
    ...previous,
    player: {
      ...previous.player,
      cardsThisTurn: [strike.id],
      zonesPlayed: ["Mid"],
      completedBeltExamThisRound: true,
    },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(strike));
  assert.equal(hosted.player.tempSpeed, 1);
});

test("Three Squirrels surfaces its third-distinct-card Character choice through the generic pending-choice UI contract", () => {
  const first = attack("first-type", "High");
  const second = kata("second-type");
  const third = consumable("third-type");
  const previous = match(board({
    fighterId: "DDB-CHR-CORE-037",
    cardsThisTurn: [first.id, second.id],
    zonesPlayed: ["High"],
  }));
  const next = {
    ...previous,
    player: {
      ...previous.player,
      cardsThisTurn: [first.id, second.id, third.id],
    },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(first, second, third));
  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.thirdDifferentCardTypeCycle");
  assert.equal(hosted.pendingChoice?.choice?.selectionField, "selectedId");
  assert.ok(hosted.player.hand.includes("d2"), "the canonical cycle draws before asking the player what to discard");
});
