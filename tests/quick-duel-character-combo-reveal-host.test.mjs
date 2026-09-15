import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  commitQuickDuelPlaytestComboRevealSelection,
  publishQuickDuelPlaytestComboReveal,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return { fighterId:"DDB-CHR-CORE-001", belt:3, hp:10, maxHp:10, xp:0, focus:0, tempSpeed:0,
    nextAttackBonus:0, nextDefenseCardBonus:0, nextAttackHasFlow:false, nextAttackAnyZone:false,
    attacksThisTurn:0, zonesPlayed:[], cardsThisTurn:[], equipment:[], exhaustedEquipment:[],
    hand:[], deck:[], discard:[], destroyed:[], learnedCombos:[], triggeredCombos:[],
    cardsBought:0, usedConsumableThisRound:false, wasHitSinceLastTurn:false, damageReductionUsed:false,
    reversalAttackBonus:0, borrowedEquipmentId:null, abilityUsedRound:false,
    usedCharacterEffectIdsThisTurn:[], usedCharacterEffectIdsThisRound:[], usedCharacterEffectIdsThisGame:[],
    characterMarks:{}, stage3cStatuses:[], stage3cChoices:[], stage3cRestrictions:[], damageDealt:0,
    damageTaken:0, completedBeltExamThisRound:false, ...overrides };
}
function match(player=board(), ai=board(), overrides={}) {
  return { schema:8, player, ai, market:[], round:1, phase:"player-ascend", turnOrder:["player","ai"],
    turnIndex:0, lastExchange:null, locationId:"loc-a", pendingChoice:null, winner:null, log:[], ...overrides };
}

test("Librarian Lin reveals exactly the face-up Combo plus the next deck Combo and waits for the human choice", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-021" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "player", "combo-a", ["combo-b","combo-c"]);
  assert.equal(hosted.published, true);
  assert.equal(hosted.event?.type, "comboReveal");
  assert.deepEqual(hosted.event?.revealIds, ["combo-a","combo-b"]);
  assert.deepEqual(hosted.choices[0]?.options, ["combo-a","combo-b"]);
  assert.equal(hosted.comboOfferId, "combo-a");
  assert.deepEqual(hosted.comboDeck, ["combo-b","combo-c"]);
});

test("the selected revealed Combo becomes the offer and the other goes face down to the bottom", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-021" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "player", "combo-a", ["combo-b","combo-c"]);
  const choice = hosted.choices[0];
  assert.ok(hosted.event && choice);
  const resolved = resolveQuickDuelPlaytestCharacterChoice(hosted.match, "player", hosted.event, choice, "combo-b");
  assert.equal(resolved.event?.selectedId, "combo-b");
  const projected = commitQuickDuelPlaytestComboRevealSelection("combo-a", ["combo-b","combo-c"], resolved.event);
  assert.equal(projected.comboOfferId, "combo-b");
  assert.deepEqual(projected.comboDeck, ["combo-c","combo-a"]);
  assert.ok(resolved.match.player.usedCharacterEffectIdsThisRound?.includes("character-librarian-combo-choice"));
});

test("AI resolves the same canonical reveal contract deterministically without exposing a hidden extra choice", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-021" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "ai", "combo-a", ["combo-b","combo-c"]);
  assert.equal(hosted.choices.length, 0);
  assert.equal(hosted.comboOfferId, "combo-a");
  assert.deepEqual(hosted.comboDeck, ["combo-c","combo-b"]);
  assert.ok(hosted.match.ai.usedCharacterEffectIdsThisRound?.includes("character-librarian-combo-choice"));
});

test("fighters without comboReveal subscription do not inspect or mutate the hidden Combo deck", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-001" }));
  const hosted = publishQuickDuelPlaytestComboReveal(current, "player", "combo-a", ["combo-b","combo-c"]);
  assert.equal(hosted.published, false);
  assert.equal(hosted.event, null);
  assert.deepEqual(hosted.comboDeck, ["combo-b","combo-c"]);
});

test("projection refuses stale or fabricated reveal facts", () => {
  assert.deepEqual(
    commitQuickDuelPlaytestComboRevealSelection("combo-a", ["combo-b","combo-c"], { type:"comboReveal", revealIds:["combo-a","combo-x"], selectedId:"combo-x" }),
    { comboOfferId:"combo-a", comboDeck:["combo-b","combo-c"] },
  );
});

test("Quick Duel publishes comboReveal only on the real Ascend reveal seam and resolves through generic Character choice", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /publishQuickDuelPlaytestComboReveal\(ascended, "player", ascended\.comboOfferId, ascended\.comboDeck\)/);
  assert.match(source, /pending\.event\.type === "comboReveal"/);
  assert.match(source, /commitQuickDuelPlaytestComboRevealSelection\(resolvedMatch\.comboOfferId, resolvedMatch\.comboDeck, resolved\.event\)/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-021["']/);
  assert.doesNotMatch(source, /Librarian Lin/);
});
