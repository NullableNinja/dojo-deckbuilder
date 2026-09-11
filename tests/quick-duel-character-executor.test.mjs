import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { publishQuickDuelCharacterEventSafely } from "../app/quick-duel-character-executor.ts";

const source = await readFile(new URL("../app/quick-duel-character-executor.ts", import.meta.url), "utf8");

function board(fighterId = "test-fighter") {
  return {
    fighterId,
    belt: 0,
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextAttackAnyZone: false,
    nextAttackHasFlow: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: [],
    deck: [],
    discard: [],
    destroyed: [],
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    nextInitiateFocus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    hostSentinel: "preserve-me",
  };
}

test("migration-safe Character publisher refuses compatibility-conflicted pre-action events", () => {
  for (const type of ["attackDeclared", "damageIncoming", "equip"]) {
    const self = board();
    const opponent = board("opponent");
    const publication = publishQuickDuelCharacterEventSafely(self, opponent, { type }, "player");
    assert.equal(publication.published, false, type);
    assert.equal(publication.conflict, true, type);
    assert.equal(publication.result, null, type);
    assert.equal(self.hostSentinel, "preserve-me");
  }
});

test("non-overlapping Character events publish through the canonical structured runtime", () => {
  for (const type of ["cardPlayed", "hit", "block", "kataPlayed", "promotion", "hide"]) {
    const publication = publishQuickDuelCharacterEventSafely(board(), board("opponent"), { type }, "player");
    assert.equal(publication.published, true, type);
    assert.equal(publication.conflict, false, type);
    assert.ok(publication.result, type);
    assert.equal(publication.result.self.hostSentinel, "preserve-me", type);
  }
});

test("Character publisher is policy-only: no fighter/card identity or printed rule dispatch", () => {
  assert.doesNotMatch(source, /DDB-CHR-CORE-|fighterId\s*===|\.name\s*===|rulesText|abilityText/);
  assert.match(source, /publishQuickDuelCharacterEvent/);
  assert.match(source, /quickDuelCharacterEventHasCompatibilityConflict/);
});
