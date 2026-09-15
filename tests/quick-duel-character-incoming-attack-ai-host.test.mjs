import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { publishQuickDuelPlaytestIncomingAttack } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-001", belt: 3, hp: 10, maxHp: 10, xp: 0, focus: 0, tempSpeed: 0,
    nextAttackBonus: 0, nextDefenseCardBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,
    attacksThisTurn: 0, zonesPlayed: [], cardsThisTurn: [], equipment: [], exhaustedEquipment: [],
    hand: ["h1"], deck: ["d1"], discard: [], destroyed: [], learnedCombos: [], triggeredCombos: [],
    cardsBought: 0, usedConsumableThisRound: false, wasHitSinceLastTurn: false, damageReductionUsed: false,
    reversalAttackBonus: 0, borrowedEquipmentId: null, abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [],
    characterMarks: {}, stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [],
    damageDealt: 0, damageTaken: 0, completedBeltExamThisRound: false, ...overrides,
  };
}

function match(ai) {
  return { player: board(), ai, market: [], round: 1, phase: "player-yell", turnOrder: ["player", "ai"], turnIndex: 0, lastExchange: null };
}

test("AI Blurred Monk automatically resolves incomingAttackDeclared through the generic Character choice contract", () => {
  const result = publishQuickDuelPlaytestIncomingAttack(match(board({ fighterId: "DDB-CHR-CORE-003" })), "ai", { attackPower: 7, modifierBonus: 3 });
  assert.equal(result.choices.length, 0);
  assert.equal(result.event?.attackPower, 6);
  assert.equal(result.match.ai.tempSpeed, -1);
  assert.equal(result.match.ai.characterMarks["round:reducedIncomingAttack"], true);
});

test("AI Gramma Uppercut removes only the structured modifier bonus", () => {
  const result = publishQuickDuelPlaytestIncomingAttack(match(board({ fighterId: "DDB-CHR-CORE-014" })), "ai", { attackPower: 8, modifierBonus: 3 });
  assert.equal(result.choices.length, 0);
  assert.equal(result.event?.attackPower, 5);
  assert.equal(result.event?.modifierBonus, 3);
});

test("AI Nerfhammer applies its passive incoming attack reduction", () => {
  const result = publishQuickDuelPlaytestIncomingAttack(match(board({ fighterId: "DDB-CHR-CORE-035" })), "ai", { attackPower: 7, modifierBonus: 2 });
  assert.equal(result.event?.attackPower, 6);
  assert.equal(result.match.ai.characterMarks["round:nerfhammerReduced"], true);
});

test("player defenders keep human Character choices unresolved", () => {
  const result = publishQuickDuelPlaytestIncomingAttack({ ...match(board()), player: board({ fighterId: "DDB-CHR-CORE-003" }) }, "player", { attackPower: 7, modifierBonus: 3 });
  assert.equal(result.choices.length, 1);
  assert.equal(result.event?.attackPower, 7);
});

test("Quick Duel publishes the AI defender event for both normal player strikes and reversals", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const calls = source.match(/publishQuickDuelPlaytestIncomingAttack\([^;]+?"ai"/gs) ?? [];
  assert.ok(calls.length >= 2, `expected at least two AI-defender incoming attack publications, found ${calls.length}`);
});
