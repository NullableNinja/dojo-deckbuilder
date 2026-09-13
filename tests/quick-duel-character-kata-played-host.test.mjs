import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQuickDuelPlaytestTransition,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

const kata = (id) => ({ id, name: id, cardType: "Technique", subtype: "Kata", tags: [], zone: null });

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
    hand: ["h1"],
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

test("Margo Two-Forms receives kataPlayed after her first Kata and resumes its zone choice generically", () => {
  const form = kata("first-form");
  const previous = match(board({ fighterId: "DDB-CHR-CORE-022" }));
  const next = {
    ...previous,
    player: { ...previous.player, cardsThisTurn: [form.id] },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(form));
  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type, "kataPlayed");
  assert.equal(hosted.pendingChoice?.event?.firstKataThisTurn, true);
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.firstKataDefenseZone");
  assert.deepEqual(hosted.pendingChoice?.choice?.options, ["High", "Mid", "Low"]);

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    hosted,
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "Low",
  );
  assert.equal(resolved.match.player.characterMarks["turn:nextDefenseExtraZone"], "Low");
  assert.equal(resolved.choices.length, 0);
});

test("Paper Crane gets first-Kata Speed then its Green second-Kata cycle through the same bridge", () => {
  const first = kata("paper-form-one");
  const second = kata("paper-form-two");
  const initial = match(board({ fighterId: "DDB-CHR-CORE-027", hand: ["h1"], deck: ["d1", "d2"] }));

  const afterFirst = applyQuickDuelPlaytestTransition(initial, {
    ...initial,
    player: { ...initial.player, cardsThisTurn: [first.id] },
  }, lookupWith(first, second));
  assert.equal(afterFirst.player.tempSpeed, 1);
  assert.equal(afterFirst.player.characterMarks["turn:structuredHost.kataCount"], 1);
  assert.equal(afterFirst.pendingChoice, null);

  const afterSecond = applyQuickDuelPlaytestTransition(afterFirst, {
    ...afterFirst,
    player: { ...afterFirst.player, cardsThisTurn: [first.id, second.id] },
  }, lookupWith(first, second));
  assert.equal(afterSecond.pendingChoice?.kind, "character-runtime");
  assert.equal(afterSecond.pendingChoice?.event?.type, "kataPlayed");
  assert.equal(afterSecond.pendingChoice?.event?.secondKataThisTurn, true);
  assert.equal(afterSecond.pendingChoice?.choice?.resolver, "character.green.secondKataCycle");
  assert.ok(afterSecond.player.hand.includes("d2"), "the canonical second-Kata cycle draws before asking what to discard");

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    afterSecond,
    "player",
    afterSecond.pendingChoice.event,
    afterSecond.pendingChoice.choice,
    "h1",
  );
  assert.equal(resolved.match.player.focus, 1);
  assert.ok(resolved.match.player.discard.includes("h1"));
  assert.equal(resolved.choices.length, 0);
});

test("Kata ordinal resets with the Character turn state", () => {
  const first = kata("turn-one-form");
  const nextTurnForm = kata("turn-two-form");
  const initial = match(board({ fighterId: "DDB-CHR-CORE-027" }));
  const afterFirst = applyQuickDuelPlaytestTransition(initial, {
    ...initial,
    player: { ...initial.player, cardsThisTurn: [first.id] },
  }, lookupWith(first, nextTurnForm));
  assert.equal(afterFirst.player.characterMarks["turn:structuredHost.kataCount"], 1);

  const nextTurn = {
    ...afterFirst,
    turnIndex: 1,
    phase: "ai-ready",
    player: {
      ...afterFirst.player,
      cardsThisTurn: [],
      usedCharacterEffectIdsThisTurn: [],
      characterMarks: Object.fromEntries(Object.entries(afterFirst.player.characterMarks).filter(([key]) => !key.startsWith("turn:"))),
    },
  };
  const newTurnMatch = {
    ...nextTurn,
    turnIndex: 0,
    phase: "player-yell",
    player: { ...nextTurn.player, cardsThisTurn: [nextTurnForm.id] },
  };
  const hosted = applyQuickDuelPlaytestTransition(nextTurn, newTurnMatch, lookupWith(first, nextTurnForm));
  assert.equal(hosted.player.tempSpeed, 2, "a new turn treats the next Kata as first again");
  assert.equal(hosted.player.characterMarks["turn:structuredHost.kataCount"], 1);
});
