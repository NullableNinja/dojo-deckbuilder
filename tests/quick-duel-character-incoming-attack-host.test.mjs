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
    deck: ["d1"],
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
    phase: "ai-ready",
    turnOrder: ["player", "ai"],
    turnIndex: 1,
    lastExchange: null,
    pendingStrike: null,
    pendingChoice: null,
    winner: null,
    log: [],
    ...overrides,
  };
}

const noCards = () => null;

function declaredStrike(previous, attackPower = 7, modifierBonus = 3) {
  return {
    ...previous,
    phase: "defense-window",
    pendingStrike: {
      cardId: "attack-1",
      zone: "High",
      attackPower,
      modifierBonus,
      damageModifier: 0,
      modifierNotes: [],
      remainingAiAttacks: [],
    },
  };
}

test("Blurred Monk receives the live incomingAttackDeclared choice and projects the accepted reduction into pendingStrike", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-003", tempSpeed: 0 }));
  const hosted = applyQuickDuelPlaytestTransition(previous, declaredStrike(previous), noCards);

  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type, "incomingAttackDeclared");
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.incomingAttackSlowChoice");
  assert.equal(hosted.pendingStrike.attackPower, 7);

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    { ...hosted, pendingChoice: null },
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "accept",
  );

  assert.equal(resolved.match.pendingStrike.attackPower, 6);
  assert.equal(resolved.match.player.tempSpeed, -1);
  assert.equal(resolved.match.player.characterMarks["round:reducedIncomingAttack"], true);
});

test("Gramma Uppercut ignores the actual positive modifier bonus rather than the whole strike", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-014" }));
  const hosted = applyQuickDuelPlaytestTransition(previous, declaredStrike(previous, 8, 3), noCards);
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.ignoreTemporaryAttackBonusesOnceGame");

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    { ...hosted, pendingChoice: null },
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "accept",
  );
  assert.equal(resolved.match.pendingStrike.attackPower, 5);
  assert.equal(resolved.match.pendingStrike.modifierBonus, 3);
});

test("The Nerfhammer auto-reduces a strike with at least +2 modifier bonus", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-035" }));
  const hosted = applyQuickDuelPlaytestTransition(previous, declaredStrike(previous, 7, 2), noCards);
  assert.equal(hosted.pendingChoice, null);
  assert.equal(hosted.pendingStrike.attackPower, 6);
  assert.equal(hosted.player.characterMarks["round:nerfhammerReduced"], true);
});

test("an already-open pending strike does not republish incomingAttackDeclared on unrelated transitions", () => {
  const previous = declaredStrike(match(board({ fighterId: "DDB-CHR-CORE-035" })), 7, 2);
  const next = { ...previous, log: ["unrelated update"] };
  const hosted = applyQuickDuelPlaytestTransition(previous, next, noCards);
  assert.equal(hosted.pendingStrike.attackPower, 7);
  assert.equal(hosted.player.characterMarks["round:nerfhammerReduced"], undefined);
});
