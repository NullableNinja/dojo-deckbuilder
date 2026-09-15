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
    phase: "player-initiate",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    locationId: "loc-a",
    pendingChoice: null,
    winner: null,
    log: [],
    ...overrides,
  };
}

const noCards = () => null;

function scopedBoard(prefix) {
  return board({
    usedCharacterEffectIdsThisTurn: [`${prefix}-turn-effect`],
    usedCharacterEffectIdsThisRound: [`${prefix}-round-effect`],
    usedCharacterEffectIdsThisGame: [`${prefix}-game-effect`],
    characterMarks: {
      [`turn:${prefix}`]: true,
      [`round:${prefix}`]: true,
      [`game:${prefix}`]: true,
    },
  });
}

test("turn handoff resets only the newly active fighter's Character turn scope", () => {
  const player = scopedBoard("player");
  const ai = scopedBoard("ai");
  const previous = match(player, ai);
  const next = { ...previous, phase: "ai-ready", turnIndex: 1 };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);

  assert.deepEqual(hosted.ai.usedCharacterEffectIdsThisTurn, []);
  assert.equal(hosted.ai.characterMarks?.["turn:ai"], undefined);
  assert.deepEqual(hosted.ai.usedCharacterEffectIdsThisRound, ["ai-round-effect"]);
  assert.deepEqual(hosted.ai.usedCharacterEffectIdsThisGame, ["ai-game-effect"]);
  assert.equal(hosted.ai.characterMarks?.["round:ai"], true);
  assert.equal(hosted.ai.characterMarks?.["game:ai"], true);

  assert.deepEqual(hosted.player.usedCharacterEffectIdsThisTurn, ["player-turn-effect"]);
  assert.deepEqual(hosted.player.usedCharacterEffectIdsThisRound, ["player-round-effect"]);
  assert.deepEqual(hosted.player.usedCharacterEffectIdsThisGame, ["player-game-effect"]);
});

test("round advance resets both fighters' turn/round Character scopes but preserves game scope", () => {
  const player = scopedBoard("player");
  const ai = scopedBoard("ai");
  const previous = match(player, ai, { phase: "ai-ready", turnIndex: 1 });
  const next = {
    ...previous,
    round: 2,
    phase: "player-initiate",
    turnIndex: 0,
    player: { ...player },
    ai: { ...ai },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);

  for (const [prefix, fighter] of [["player", hosted.player], ["ai", hosted.ai]]) {
    assert.deepEqual(fighter.usedCharacterEffectIdsThisTurn, []);
    assert.deepEqual(fighter.usedCharacterEffectIdsThisRound, []);
    assert.deepEqual(fighter.usedCharacterEffectIdsThisGame, [`${prefix}-game-effect`]);
    assert.equal(fighter.characterMarks?.[`turn:${prefix}`], undefined);
    assert.equal(fighter.characterMarks?.[`round:${prefix}`], undefined);
    assert.equal(fighter.characterMarks?.[`game:${prefix}`], true);
  }
});
