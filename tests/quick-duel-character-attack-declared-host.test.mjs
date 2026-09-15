import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  previewQuickDuelPlaytestCharacterAttackZones,
  publishQuickDuelPlaytestAttackDeclared,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";
import { quickDuelCompatibilityOwnedResolvers, quickDuelCharacterEventHasCompatibilityConflict } from "../app/quick-duel-character-migration.ts";

const cards = new Map([
  ["kick", { id:"kick", name:"Kick", cardType:"Attack", subtype:"Technique", zone:"High", tags:["Kick"] }],
  ["spin", { id:"spin", name:"Spin", cardType:"Attack", subtype:"Technique", zone:"High", tags:["Spin"] }],
  ["kata", { id:"kata", name:"Kata", cardType:"Kata", subtype:"Kata", zone:null, tags:[] }],
  ["weapon", { id:"weapon", name:"Weapon", cardType:"Item", subtype:"Weapon", zone:null, tags:["Weapon"] }],
]);
const lookup = (id) => cards.get(id) ?? null;
function board(overrides = {}) { return { fighterId:"DDB-CHR-CORE-001", belt:3, hp:10, maxHp:10, xp:0, focus:0, tempSpeed:0, nextAttackBonus:0, nextDefenseCardBonus:0, nextAttackAnyZone:false, nextAttackHasFlow:false, attacksThisTurn:0, zonesPlayed:[], cardsThisTurn:[], equipment:[], exhaustedEquipment:[], hand:[], deck:[], discard:[], destroyed:[], usedConsumableThisRound:false, wasHitSinceLastTurn:false, damageReductionUsed:false, reversalAttackBonus:0, borrowedEquipmentId:null, abilityUsedRound:false, usedCharacterEffectIdsThisTurn:[], usedCharacterEffectIdsThisRound:[], usedCharacterEffectIdsThisGame:[], characterMarks:{}, learnedCombos:[], triggeredCombos:[], stage3cStatuses:[], stage3cChoices:[], stage3cRestrictions:[], ...overrides }; }
function match(player=board(), ai=board()) { return { player, ai, lastExchange:null, locationId:"loc", round:1, turnIndex:0 }; }

test("Character zone preview is canonical: Glitterpunch gets Mid only, Whirlwind gets Any on first Spin", () => {
  const glitter = match(board({ fighterId:"DDB-CHR-CORE-013" }));
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(glitter, "player", cards.get("kick"), ["High"], lookup), ["High","Mid"]);
  const whirlwind = match(board({ fighterId:"DDB-CHR-CORE-041" }));
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(whirlwind, "player", cards.get("spin"), ["High"], lookup), ["High","Mid","Low"]);
});

test("Miss Direction exposes alternate zones only when the discard cost can actually be paid", () => {
  const withCard = match(board({ fighterId:"DDB-CHR-CORE-025", hand:["discard-me"] }));
  const empty = match(board({ fighterId:"DDB-CHR-CORE-025", hand:[] }));
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(withCard, "player", cards.get("kick"), ["High"], lookup), ["High","Mid","Low"]);
  assert.deepEqual(previewQuickDuelPlaytestCharacterAttackZones(empty, "player", cards.get("kick"), ["High"], lookup), ["High"]);
});

test("Miss Direction pauses declaration for the discard cost, then resumes with canonical changed-zone state", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-025", hand:["discard-me"] }));
  const declared = publishQuickDuelPlaytestAttackDeclared(current, "player", cards.get("kick"), "Low", 5, lookup);
  assert.equal(declared.choices.length, 1);
  assert.equal(declared.choices[0].optional, false);
  const resolved = resolveQuickDuelPlaytestCharacterChoice(declared.match, "player", declared.event, declared.choices[0], "discard-me");
  assert.equal(resolved.event?.changedZone, true);
  assert.deepEqual(resolved.match.player.hand, []);
  assert.deepEqual(resolved.match.player.discard, ["discard-me"]);
});

test("declaration power uses the selected zone and canonical Character state", () => {
  const karatesaurus = match(board({ fighterId:"DDB-CHR-CORE-018", zonesPlayed:["Mid"] }));
  const kick = publishQuickDuelPlaytestAttackDeclared(karatesaurus, "player", cards.get("kick"), "Low", 5, lookup);
  assert.equal(kick.event?.attackPower, 6);
  assert.equal(kick.match.player.characterMarks?.["turn:kickBonus"], true);
  const punchline = match(board({ fighterId:"DDB-CHR-CORE-028", cardsThisTurn:["kata"] }));
  const punch = publishQuickDuelPlaytestAttackDeclared(punchline, "player", cards.get("kick"), "High", 5, lookup);
  assert.equal(punch.event?.attackPower, 6);
});

test("AI resolves declaration costs through the same generic runtime", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-025", hand:["discard-me"] }));
  const declared = publishQuickDuelPlaytestAttackDeclared(current, "ai", cards.get("kick"), "Low", 5, lookup);
  assert.equal(declared.choices.length, 0);
  assert.equal(declared.event?.changedZone, true);
  assert.deepEqual(declared.match.ai.hand, []);
});

test("Stage 3E attack declaration leaves no compatibility-owned Character resolver", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), false);
  assert.deepEqual(quickDuelCompatibilityOwnedResolvers(), []);
});

test("Quick Duel commits all three declaration paths through the generic host and removes legacy Character helpers", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.ok((source.match(/publishQuickDuelPlaytestAttackDeclared\(/g) ?? []).length >= 3);
  assert.doesNotMatch(source, /characterAttackModifier\s*\(/);
  assert.doesNotMatch(source, /characterAllowedAttackZones\s*\(/);
  assert.doesNotMatch(source, /fighterAttackModifier\s*\(/);
  assert.doesNotMatch(source, /structuredRuntimeResolvers\([^)]*character\.xpTrailFirstHit/);
  assert.match(source, /pendingCharacterAttackDeclaration/);
  assert.match(source, /continuation: "player-attack"/);
  assert.match(source, /continuation: "player-reversal"/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-/);
});
