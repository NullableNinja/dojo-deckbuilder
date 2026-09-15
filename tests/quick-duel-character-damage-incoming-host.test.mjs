import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publishQuickDuelPlaytestDamageIncoming } from "../app/quick-duel-playtest-host.ts";
import { quickDuelCharacterEventHasCompatibilityConflict } from "../app/quick-duel-character-migration.ts";

function board(overrides = {}) {
  return { fighterId:"DDB-CHR-CORE-001", belt:3, hp:10, maxHp:10, xp:0, focus:0, tempSpeed:0,
    nextAttackBonus:0, nextDefenseCardBonus:0, nextAttackHasFlow:false, nextAttackAnyZone:false,
    attacksThisTurn:0, zonesPlayed:[], cardsThisTurn:[], equipment:[], exhaustedEquipment:[],
    hand:[], deck:[], discard:[], destroyed:[], learnedCombos:[], triggeredCombos:[],
    usedConsumableThisRound:false, wasHitSinceLastTurn:false, damageReductionUsed:false,
    reversalAttackBonus:0, borrowedEquipmentId:null, abilityUsedRound:false,
    usedCharacterEffectIdsThisTurn:[], usedCharacterEffectIdsThisRound:[], usedCharacterEffectIdsThisGame:[],
    characterMarks:{}, stage3cStatuses:[], stage3cChoices:[], stage3cRestrictions:[], damageDealt:0, damageTaken:0,
    ...overrides };
}
function match(player=board(), ai=board()) { return { player, ai, lastExchange:null, locationId:"loc", round:1, turnIndex:0 }; }

test("Crash Test Dummy damageIncoming runs through event runtime and chains Green delayed Focus", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-007", belt:3 }));
  const hosted = publishQuickDuelPlaytestDamageIncoming(current, "ai", 4);
  assert.equal(hosted.published, true);
  assert.equal(hosted.conflict, false);
  assert.equal(hosted.event?.damage, 3);
  assert.equal(hosted.match.ai.nextInitiateFocus, 1);
  assert.ok(hosted.match.ai.usedCharacterEffectIdsThisRound?.includes("character-crash-impact-rated"));
});

test("Sentry Bobby player damageIncoming prevents first Hit and arms Green retaliation without a compatibility helper", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-031", belt:3 }), board());
  const hosted = publishQuickDuelPlaytestDamageIncoming(current, "player", 3);
  assert.equal(hosted.event?.damage, 2);
  assert.equal(hosted.match.player.nextAttackBonus, 1);
  assert.equal(hosted.choices.length, 0);
  assert.ok(hosted.match.player.usedCharacterEffectIdsThisRound?.includes("character-sentry-first-hit-prevent"));
});

test("damageIncoming is no longer compatibility-blocked", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);
});

test("all three live combat damage seams publish through the generic Character host and the direct reduction helper is gone", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/publishQuickDuelPlaytestDamageIncoming\(/g) ?? []).length, 3);
  assert.doesNotMatch(source, /characterDamageReduction\s*\(/);
  assert.match(source, /reduceNonCharacterDamageForFighter/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-/);
});
