import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyCharacterRuntimeEvent,
  characterPurchasePrice,
  resetCharacterRound,
  resetCharacterTurn,
} from "../app/character-runtime.ts";
import {
  resolveLocationEffects,
  structuredLocationAttackModifiers,
  structuredLocationHealingModifier,
  structuredLocationPurchaseCostModifier,
} from "../app/location-effect-resolvers.ts";
import {
  locationRuntimeDelta,
  markLocationCommandsUsed,
  resetLocationRound,
  resetLocationScene,
  resetLocationTurn,
} from "../app/location-runtime.ts";

const playtestSource = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

function board(fighterId, overrides = {}) {
  return {
    fighterId,
    belt: 3,
    hp: 20,
    maxHp: 25,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackAnyZone: false,
    nextAttackHasFlow: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: ["h1", "h2"],
    deck: ["d1", "d2"],
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
    locationUsedEffectsThisTurn: [],
    locationUsedEffectsThisRound: [],
    locationUsedEffectsThisScene: [],
    ...overrides,
  };
}

const attack = (tags = [], zone = "High") => ({ id: "attack", cardType: "Attack", subtype: "Attack", tags, zone });

test("Coupon Carl composes after the active Location purchase modifier, preserving both canonical floors", () => {
  const couponCarl = board("DDB-CHR-CORE-006");
  const conference = structuredLocationPurchaseCostModifier(
    { catalogId: "DDB-LOC-CORE-011" },
    { cardTypeAny: ["Item"], firstMatchingPerTurn: true },
  );
  assert.equal(conference.amount, -1);
  assert.equal(conference.minimum, 1);
  const afterLocation = Math.max(conference.minimum, 7 + conference.amount);
  assert.equal(afterLocation, 6);
  assert.equal(characterPurchasePrice(couponCarl, afterLocation), 5);
  assert.equal(characterPurchasePrice(couponCarl, 4), 4);
});

test("Character and Location Attack modifiers both contribute without replacing each other", () => {
  const flamingMonk = board("DDB-CHR-CORE-012", { usedConsumableThisRound: true });
  const opponent = board("DDB-CHR-CORE-001");
  const declared = applyCharacterRuntimeEvent(
    flamingMonk,
    opponent,
    { type: "attackDeclared", card: attack(), firstAttackThisTurn: true, usedConsumableThisTurn: true, attackPower: 2 },
    "ai",
  );
  const scene = structuredLocationAttackModifiers(
    { catalogId: "DDB-LOC-CORE-030" },
    { firstAttackThisTurn: true, attackZone: "High", attackTagAny: [], equipmentTagAny: [] },
  );
  assert.equal(declared.event.attackPower, 3);
  assert.equal(scene.power, -1);
  assert.equal(declared.event.attackPower + scene.power, 2);
});

test("Character prevention and Location healing remain separate, composable real state transitions", () => {
  const sentry = board("DDB-CHR-CORE-031", { hp: 18 });
  const protectedHit = applyCharacterRuntimeEvent(
    sentry,
    board("DDB-CHR-CORE-001"),
    { type: "damageIncoming", damage: 3 },
    "ai",
  );
  const farmersMarket = structuredLocationHealingModifier(
    { catalogId: "DDB-LOC-CORE-017" },
    { healingSourceAny: ["Consumable"] },
  );
  assert.equal(protectedHit.event.damage, 2);
  assert.equal(farmersMarket.amount, 2);
  assert.equal(Math.min(protectedHit.self.maxHp, protectedHit.self.hp - protectedHit.event.damage + 1 + farmersMarket.amount), 19);
});

test("incoming Character decisions pause the strike while Location combat modifiers stay available", () => {
  const blurredMonk = board("DDB-CHR-CORE-003");
  const decision = applyCharacterRuntimeEvent(
    blurredMonk,
    board("DDB-CHR-CORE-001"),
    { type: "incomingAttackDeclared", attackPower: 5 },
    "player",
  );
  const bus = structuredLocationAttackModifiers(
    { catalogId: "DDB-LOC-CORE-007" },
    { attackZone: "Mid", firstAttackThisTurn: true, attackTagAny: [], equipmentTagAny: [] },
  );
  assert.equal(decision.choices.length, 1);
  assert.equal(decision.event.attackPower, 5);
  assert.equal(bus.power, 1);
});

test("Character and Location lifecycle resets preserve each other's delayed state until their own expiry", () => {
  const initial = board("DDB-CHR-CORE-014", {
    characterMarks: { "turn:attack": true, "round:guard": true, "game:once": true },
    usedCharacterEffectIdsThisTurn: ["turn"],
    usedCharacterEffectIdsThisRound: ["round"],
    usedCharacterEffectIdsThisGame: ["game"],
    locationUsedEffectsThisTurn: ["turn-location"],
    locationUsedEffectsThisRound: ["round-location"],
    locationUsedEffectsThisScene: ["scene-location"],
    locationChosenCounterZone: "Low",
    locationNextRoundSpeed: -2,
  });
  const turn = resetLocationTurn(resetCharacterTurn(initial));
  assert.deepEqual(turn.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(turn.usedCharacterEffectIdsThisRound, ["round"]);
  assert.deepEqual(turn.locationUsedEffectsThisTurn, []);
  assert.equal(turn.locationChosenCounterZone, "Low");
  const scene = resetLocationScene(turn);
  assert.equal(scene.locationChosenCounterZone, "Low");
  assert.equal(scene.characterMarks["round:guard"], true);
  const round = resetLocationRound(resetCharacterRound(scene));
  assert.deepEqual(round.usedCharacterEffectIdsThisRound, []);
  assert.deepEqual(round.usedCharacterEffectIdsThisGame, ["game"]);
  assert.equal(round.characterMarks["game:once"], true);
  assert.equal(round.locationChosenCounterZone, null);
  assert.equal(round.locationNextRoundSpeed, 0);
  assert.equal(round.tempSpeed, -2);
});

test("Location state is marked through its structured command without consuming Character usage state", () => {
  const commands = resolveLocationEffects(
    { catalogId: "DDB-LOC-CORE-018" },
    { locationEvent: "block", oncePerRound: true },
  ).filter((command) => command.effectId === "location-018-block-counter-zone-choice");
  const initial = board("DDB-CHR-CORE-001", { usedCharacterEffectIdsThisRound: ["character-auntie-parry-reversal-power"] });
  const marked = markLocationCommandsUsed(initial, commands);
  const delta = locationRuntimeDelta(commands);
  assert.equal(delta.choices.length, 1);
  assert.ok(marked.locationUsedEffectsThisRound.includes("location-018-block-counter-zone-choice"));
  assert.deepEqual(marked.usedCharacterEffectIdsThisRound, ["character-auntie-parry-reversal-power"]);
});

test("Playtest host remains free of direct Character and Location card-ID special cases", () => {
  assert.doesNotMatch(playtestSource, /fighterId\s*===\s*["']DDB-CHR-CORE-/);
  assert.doesNotMatch(playtestSource, /locationId\s*===\s*["']DDB-LOC-CORE-/);
});
