import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  applyCharacterRuntimeEvent,
  characterCanReadyEquipment,
  characterRuntimeEventAvailable,
  resetCharacterTurn,
} from "../app/character-runtime.ts";
import { publishQuickDuelPlaytestCharacterAction } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-036", belt: 0, hp: 10, maxHp: 10, xp: 0, focus: 0, tempSpeed: 0,
    nextAttackBonus: 0, nextDefenseCardBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,
    attacksThisTurn: 0, zonesPlayed: [], cardsThisTurn: [], equipment: ["eq-1", "eq-2"], exhaustedEquipment: [],
    hand: [], deck: ["draw-1"], discard: [], destroyed: [], usedConsumableThisRound: false,
    wasHitSinceLastTurn: false, damageReductionUsed: false, reversalAttackBonus: 0, borrowedEquipmentId: null,
    abilityUsedRound: false, usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [], characterMarks: {}, ...overrides,
  };
}

function match(ai = board()) {
  return { player: board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), ai, market: [], round: 1, phase: "ai-ready", turnOrder: ["player", "ai"], turnIndex: 1, lastExchange: null };
}

test("Rebooter canonical runtime exhausts the chosen ready Equipment, locks readying, and gains 2 Focus", () => {
  const self = board();
  assert.equal(characterRuntimeEventAvailable(self, "reboot"), true);
  const result = applyCharacterRuntimeEvent(self, board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), {
    type: "reboot", candidateIds: ["eq-1", "eq-2"], selectedId: "eq-1",
  });
  assert.equal(result.self.focus, 2);
  assert.deepEqual(result.self.exhaustedEquipment, ["eq-1"]);
  assert.equal(result.self.characterMarks["turn:rebootLocked:eq-1"], true);
  assert.equal(characterCanReadyEquipment(result.self, "eq-1"), false);
  assert.equal(characterRuntimeEventAvailable(result.self, "reboot"), false, "once-per-round usage must be consumed");

  const nextTurn = resetCharacterTurn(result.self);
  assert.equal(characterCanReadyEquipment(nextTurn, "eq-1"), true, "ready lock ends with the turn");
  assert.equal(characterRuntimeEventAvailable(nextTurn, "reboot"), false, "round usage survives a turn reset");
});

test("human Rebooter action requests an actual ready Equipment choice before applying", () => {
  const self = board({ exhaustedEquipment: ["eq-2"] });
  const result = applyCharacterRuntimeEvent(self, board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), {
    type: "reboot", candidateIds: ["eq-1"],
  }, "player");
  assert.equal(result.self.focus, 0);
  assert.equal(result.choices.length, 1);
  assert.deepEqual(result.choices[0].options, ["eq-1"]);
});

test("AI Rebooter resolves the same generic action without React input", () => {
  const result = publishQuickDuelPlaytestCharacterAction(match(), "ai", { type: "reboot", candidateIds: ["eq-1", "eq-2"] });
  assert.equal(result.choices.length, 0);
  assert.equal(result.match.ai.focus, 2);
  assert.deepEqual(result.match.ai.exhaustedEquipment, ["eq-1"]);
  assert.equal(result.match.ai.characterMarks["turn:rebootLocked:eq-1"], true);
});

test("Green-belt Rebooter chains its linked cycle after the Equipment selection", () => {
  const self = board({ belt: 3, hand: ["keep"], deck: ["draw-1"] });
  const result = applyCharacterRuntimeEvent(self, board({ fighterId: "DDB-CHR-CORE-001", equipment: [] }), {
    type: "reboot", candidateIds: ["eq-1"], selectedId: "eq-1",
  }, "player");
  assert.equal(result.self.focus, 2);
  assert.equal(result.choices.length, 1);
  assert.equal(result.self.hand.includes("draw-1"), true);
});

test("Quick Duel exposes reboot as a generic player action and AI turn action without Character identity dispatch", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /publishQuickDuelPlaytestCharacterAction\(current, "player", \{ type: "reboot", candidateIds \}\)/);
  assert.match(source, /publishQuickDuelPlaytestCharacterAction\([\s\S]*?"ai",[\s\S]*?\{ type: "reboot", candidateIds: rebootCandidates \}/);
  assert.doesNotMatch(source, /DDB-CHR-CORE-036|The Rebooter/);
});
