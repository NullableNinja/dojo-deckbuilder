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
    deck: ["d1", "d2", "d3"],
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
    phase: "player-ascend",
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

test("The Belt Collector receives promotion when entering Green and resumes its draw-two/discard-one choice", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-034", belt: 2, hand: ["h1"], deck: ["d1", "d2", "d3"] }));
  const next = {
    ...previous,
    player: { ...previous.player, belt: 3 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.player.belt, 3);
  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type, "promotion");
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.green.promotionCycle");
  assert.ok(hosted.player.hand.includes("d3"));
  assert.ok(hosted.player.hand.includes("d2"));

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    hosted,
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "h1",
  );
  assert.ok(resolved.match.player.discard.includes("h1"));
  assert.equal(resolved.match.player.hand.length, 2);
  assert.equal(resolved.choices.length, 0);
});

test("promotion below Green does not activate the Green Character ability", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-034", belt: 0, hand: ["h1"], deck: ["d1", "d2", "d3"] }));
  const next = {
    ...previous,
    player: { ...previous.player, belt: 1 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.player.belt, 1);
  assert.equal(hosted.pendingChoice, null);
  assert.deepEqual(hosted.player.hand, ["h1"]);
});

test("unchanged or reduced belt does not publish promotion", () => {
  const unchanged = match(board({ fighterId: "DDB-CHR-CORE-034", belt: 3 }));
  const unchangedHosted = applyQuickDuelPlaytestTransition(unchanged, {
    ...unchanged,
    player: { ...unchanged.player, focus: 1 },
  }, noCards);
  assert.equal(unchangedHosted.pendingChoice, null);

  const reduced = match(board({ fighterId: "DDB-CHR-CORE-034", belt: 4 }));
  const reducedHosted = applyQuickDuelPlaytestTransition(reduced, {
    ...reduced,
    player: { ...reduced.player, belt: 3 },
  }, noCards);
  assert.equal(reducedHosted.pendingChoice, null);
});

test("The Belt Collector AI resolves promotion through the same Character runtime automatically", () => {
  const previous = match(
    board(),
    board({ fighterId: "DDB-CHR-CORE-034", belt: 2, hand: ["ai-h1"], deck: ["ai-d1", "ai-d2", "ai-d3"] }),
  );
  const next = {
    ...previous,
    ai: { ...previous.ai, belt: 3 },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.ai.belt, 3);
  assert.equal(hosted.pendingChoice, null);
  assert.equal(hosted.ai.hand.length, 2);
  assert.equal(hosted.ai.discard.length, 1);
  assert.ok(hosted.ai.hand.includes("ai-d3"));
  assert.ok(hosted.ai.hand.includes("ai-d2"));
});
