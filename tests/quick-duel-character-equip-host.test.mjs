import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publishQuickDuelPlaytestEquip } from "../app/quick-duel-playtest-host.ts";
import { quickDuelCharacterEventHasCompatibilityConflict } from "../app/quick-duel-character-migration.ts";
import { equipmentHandLimit, repairEquipmentHandLimit } from "../app/equipment-hand-limit.ts";
import { runtimeCardFor } from "../app/runtime-card-catalog.ts";

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
const weapon = { id:"wpn-1", name:"Test Weapon", cardType:"Item", subtype:"Weapon", tags:["Weapon"] };
const gear = { id:"gear-1", name:"Test Gear", cardType:"Item", subtype:"Gear", tags:["Equipment"] };

test("Knuckleton equip event rejects Weapons without fighter-specific Playtest dispatch", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-019" }), board());
  const rejected = publishQuickDuelPlaytestEquip(current, "player", weapon);
  assert.equal(rejected.published, true);
  assert.equal(rejected.conflict, false);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.event?.allowed, false);
  const allowed = publishQuickDuelPlaytestEquip(current, "player", gear);
  assert.equal(allowed.allowed, true);
});

test("Mr. Clip equip event primes next Defense and consumes its once-per-round Character use", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-026" }), board());
  const hosted = publishQuickDuelPlaytestEquip(current, "player", gear);
  assert.equal(hosted.allowed, true);
  assert.equal(hosted.match.player.nextDefenseCardBonus, 1);
  assert.ok(hosted.match.player.usedCharacterEffectIdsThisRound?.includes("character-mr-clip-defense-guard"));
  assert.equal(hosted.match.player.characterMarks?.["round:clipEquip"], true);
});

test("AI uses the same equip event contract", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-019" }));
  const hosted = publishQuickDuelPlaytestEquip(current, "ai", weapon);
  assert.equal(hosted.allowed, false);
  assert.equal(hosted.choices.length, 0);
});

test("Weapon equip obeys the canonical two-Hand capacity", () => {
  const rolledRulebook = "items-weapons-56-rolled-up-rulebook";
  const poolNoodle = "items-weapons-50-pool-noodle-of-shame";
  const foldingChair = { id:"candidate-chair", name:"Candidate Chair", cardType:"Item", subtype:"Weapon", tags:["Weapon"], stats:{ Hands:"2" } };
  const extraOneHand = { id:"candidate-club", name:"Candidate Club", cardType:"Item", subtype:"Weapon", tags:["Weapon"], stats:{ Hands:"1" } };

  const oneHandOccupied = match(board({ equipment:[rolledRulebook] }), board());
  assert.equal(publishQuickDuelPlaytestEquip(oneHandOccupied, "player", extraOneHand).allowed, true);
  const blockedTwoHand = publishQuickDuelPlaytestEquip(oneHandOccupied, "player", foldingChair);
  assert.equal(blockedTwoHand.allowed, false);
  assert.equal(blockedTwoHand.event?.allowed, false);
  assert.match(blockedTwoHand.reason, /1\/2 Hands occupied/);

  const bothHandsOccupied = match(board({ equipment:[rolledRulebook, poolNoodle] }), board());
  const blockedThirdWeapon = publishQuickDuelPlaytestEquip(bothHandsOccupied, "player", extraOneHand);
  assert.equal(blockedThirdWeapon.allowed, false);
  assert.match(blockedThirdWeapon.reason, /2\/2 Hands occupied/);

  const emptyHands = match(board(), board());
  assert.equal(publishQuickDuelPlaytestEquip(emptyHands, "player", foldingChair).allowed, true);
});

test("Weapon Hand-limit repair preserves legal Equipment and discards overflow deterministically", () => {
  const rolledRulebook = "items-weapons-56-rolled-up-rulebook";
  const poolNoodle = "items-weapons-50-pool-noodle-of-shame";
  const foldingChair = "items-weapons-53-folding-chair-of-destiny";
  const club = "items-weapons-7-club";
  const equipped = [rolledRulebook, poolNoodle, foldingChair, club];

  const limit = equipmentHandLimit([rolledRulebook, poolNoodle], runtimeCardFor(club), runtimeCardFor);
  assert.equal(limit.allowed, false);
  assert.equal(limit.occupied, 2);
  assert.equal(limit.required, 1);

  const repaired = repairEquipmentHandLimit(equipped, runtimeCardFor);
  assert.deepEqual(repaired.equipment, [rolledRulebook, poolNoodle]);
  assert.deepEqual(repaired.removed, [foldingChair, club]);
  assert.equal(repaired.occupied, 2);
});

test("equip is no longer compatibility-blocked", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), false);
});

test("Quick Duel previews and commits Equip through the generic host and no longer calls characterCanEquip", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /characterCanEquip\s*\(/);
  assert.match(source, /publishQuickDuelPlaytestEquip\(current, "player", card\)/);
  assert.match(source, /publishQuickDuelPlaytestEquip\(match, "player", card\)\.allowed/);
  assert.match(source, /publishQuickDuelPlaytestEquip\(\{ \.\.\.current, player: nextPlayer, ai: nextAi \}, "ai", card\)/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-/);
});
