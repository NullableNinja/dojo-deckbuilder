import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  publishQuickDuelPlaytestAttackDeclared,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";
import {
  quickDuelCharacterEventHasCompatibilityConflict,
  quickDuelCompatibilityOwnedResolvers,
} from "../app/quick-duel-character-migration.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-001", belt: 3, hp: 25, maxHp: 25, xp: 0, focus: 0, tempSpeed: 0,
    nextAttackBonus: 0, nextDefenseCardBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,
    attacksThisTurn: 0, zonesPlayed: [], cardsThisTurn: [], equipment: [], exhaustedEquipment: [],
    hand: ["discard-me"], deck: ["d1"], discard: [], destroyed: [], learnedCombos: [], triggeredCombos: [],
    usedConsumableThisRound: false, wasHitSinceLastTurn: false, damageReductionUsed: false,
    reversalAttackBonus: 0, borrowedEquipmentId: null, abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [],
    characterMarks: {}, ...overrides,
  };
}

function match(player, ai = board()) {
  return { schema: 8, player, ai, pendingChoice: null, selectedAttackId: "atk", selectedZone: "Mid", phase: "player-yell", round: 1, turnIndex: 0 };
}

const attack = { id: "atk", name: "Test Attack", cardType: "Attack", subtype: "Attack", zone: "High", tags: ["Punch"] };

test("attackDeclared is a live generic Quick Duel host event for player and AI", () => {
  const player = board({ fighterId: "DDB-CHR-CORE-010" });
  const playerResult = publishQuickDuelPlaytestAttackDeclared(match(player), "player", attack, "Mid");
  assert.equal(playerResult.published, true);
  assert.equal(playerResult.conflict, false);
  assert.equal(playerResult.zone, "Mid");
  assert.equal(playerResult.attackPower, 1, "Doodle Bopper's linked zone power is returned by the event runtime");

  const aiResult = publishQuickDuelPlaytestAttackDeclared(match(board(), board({ fighterId: "DDB-CHR-CORE-010" })), "ai", attack, "Mid");
  assert.equal(aiResult.published, true);
  assert.equal(aiResult.attackPower, 1, "AI uses the same declaration event and modifier contract");
});

test("a paid attack-declaration choice pauses and resumes without double activation", () => {
  const first = publishQuickDuelPlaytestAttackDeclared(
    match(board({ fighterId: "DDB-CHR-CORE-025" })),
    "player",
    attack,
    "Mid",
  );
  assert.equal(first.choices.length, 1);
  assert.equal(first.choices[0].selectionField, "selectedId");

  const resumed = resolveQuickDuelPlaytestCharacterChoice(
    { ...first.match, pendingChoice: null },
    "player",
    first.event,
    first.choices[0],
    "discard-me",
  );
  assert.equal(resumed.choices.length, 0);
  assert.equal(resumed.event?.changedZone, true);
  assert.deepEqual(resumed.match.player.discard, ["discard-me"]);

  const replayed = publishQuickDuelPlaytestAttackDeclared(resumed.match, "player", attack, "Mid");
  assert.equal(replayed.attackPower, 0, "the consumed declaration resolver does not fire again");
  assert.deepEqual(replayed.match.player.discard, ["discard-me"]);
});

test("attackDeclared is no longer compatibility-blocked or directly dispatched by Playtest", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), false);
  assert.deepEqual(quickDuelCompatibilityOwnedResolvers(), []);
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /characterAllowedAttackZones|characterAttackModifier\s*\(/);
  assert.match(source, /publishQuickDuelPlaytestAttackDeclared\(/);
});
