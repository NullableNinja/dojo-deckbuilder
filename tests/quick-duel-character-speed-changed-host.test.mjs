import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQuickDuelPlaytestTransition,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

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

const noCards = () => null;

test("Baron von Backflip receives speedChanged when Speed increases", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-002", tempSpeed: 0 }));
  const next = {
    ...previous,
    player: { ...previous.player, tempSpeed: 1 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.player.tempSpeed, 1);
  assert.equal(hosted.player.nextAttackAnyZone, true);
});

test("speedChanged means any Speed change, including a reduction", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-002", tempSpeed: 0 }));
  const next = {
    ...previous,
    player: { ...previous.player, tempSpeed: -1 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.player.tempSpeed, -1);
  assert.equal(hosted.player.nextAttackAnyZone, true);
});

test("unchanged Speed does not publish speedChanged", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-002", tempSpeed: 1, nextAttackAnyZone: false }));
  const next = {
    ...previous,
    player: { ...previous.player, focus: 1 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.player.tempSpeed, 1);
  assert.equal(hosted.player.nextAttackAnyZone, false);
});

test("Late Bell Lee player Speed change uses the generic Character cycle choice", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-020", tempSpeed: 0, hand: ["h1"], deck: ["d1", "d2"] }));
  const next = {
    ...previous,
    player: { ...previous.player, tempSpeed: 1 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type, "speedChanged");
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.speedChangeCycle");
  assert.ok(hosted.player.hand.includes("d2"), "Late Bell draws before asking what to discard");

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    hosted,
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "h1",
  );
  assert.ok(resolved.match.player.discard.includes("h1"));
  assert.equal(resolved.choices.length, 0);
});

test("Late Bell Lee AI resolves the same Speed-change cycle without a UI choice", () => {
  const previous = match(
    board(),
    board({ fighterId: "DDB-CHR-CORE-020", tempSpeed: 0, hand: ["ai-h1"], deck: ["ai-d1", "ai-d2"] }),
  );
  const next = {
    ...previous,
    ai: { ...previous.ai, tempSpeed: -1 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.ai.tempSpeed, -1);
  assert.equal(hosted.pendingChoice, null);
  assert.ok(hosted.ai.discard.includes("ai-h1"), "AI uses the same deterministic Character choice contract");
  assert.ok(hosted.ai.hand.includes("ai-d2"));
});
