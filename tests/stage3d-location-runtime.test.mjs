import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  resolveLocationEffects,
  locationUsageScopes,
} from "../app/location-effect-resolvers.ts";
import {
  locationRuntimeDelta,
  locationUsageContext,
  markLocationCommandsUsed,
  resetLocationRound,
  resetLocationScene,
  resetLocationTurn,
  usedAcrossPlayersAfter,
} from "../app/location-runtime.ts";

const source = JSON.parse(await readFile(new URL("../content/card-effects/locations.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8"));
const playtestSource = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const resolverSource = await readFile(new URL("../app/location-effect-resolvers.ts", import.meta.url), "utf8");

const canonical = cards.cards.filter((card) => card.cardType === "Location" && card.catalogId.includes("-LOC-CORE-"));
const metadataKinds = new Set([
  "locationOperation",
  "minimumFinalValue",
  "maximumFinalValue",
  "choiceOptions",
  "discardCount",
  "destroyCount",
  "drawCount",
  "focusGain",
  "hpLoss",
  "fixedValue",
  "maximumLoss",
  "appliesNextRound",
]);

function satisfyingContext(effect) {
  const context = {};
  for (const condition of effect.conditions ?? []) {
    const kind = String(condition.kind ?? "");
    if (!kind || metadataKinds.has(kind)) continue;
    if ((condition.operator ?? "eq") === "neq") {
      context[kind] = typeof condition.value === "boolean" ? !condition.value : `not-${String(condition.value)}`;
      continue;
    }
    if ((condition.operator ?? "eq") === "notIncludes") {
      context[kind] = [];
      continue;
    }
    context[kind] = condition.value;
  }
  return context;
}

function commandFor(catalogId, effectId) {
  const effect = source.cards[catalogId].effects.find((candidate) => candidate.id === effectId);
  assert.ok(effect, `${catalogId}/${effectId} missing canonical effect`);
  const command = resolveLocationEffects({ catalogId }, satisfyingContext(effect)).find((candidate) => candidate.effectId === effect.id);
  assert.ok(command, `${catalogId}/${effectId} did not resolve`);
  return command;
}

function meaningfulDelta(delta) {
  const { commands, ...fields } = delta;
  return Object.entries(fields).some(([key, value]) => {
    if (key === "choices") return Array.isArray(value) && value.length > 0;
    if (key === "kataFocusSet") return value !== null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    return value !== null;
  });
}

test("Stage 3D canonical roster is exactly 53 Core Locations / 99 structured effects", () => {
  assert.equal(canonical.length, 53);
  assert.equal(Object.keys(source.cards).length, 53);
  const effectCount = Object.values(source.cards).reduce((total, entry) => total + entry.effects.length, 0);
  assert.equal(effectCount, 99);
});

test("all 99 Location effects select from structured context without prose interpretation", () => {
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    for (const effect of entry.effects) {
      const commands = resolveLocationEffects({ catalogId }, satisfyingContext(effect));
      assert.ok(commands.some((command) => command.effectId === effect.id), `${catalogId}/${effect.id} did not resolve from structured predicates`);
    }
  }
});

test("every canonical Location produces executable state/delta or an explicit choice", () => {
  const covered = new Set();
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    for (const effect of entry.effects) {
      const command = resolveLocationEffects({ catalogId }, satisfyingContext(effect)).find((candidate) => candidate.effectId === effect.id);
      assert.ok(command, `${catalogId}/${effect.id} missing command`);
      assert.ok(meaningfulDelta(locationRuntimeDelta([command])), `${catalogId}/${effect.id} has no executable runtime state/delta`);
      covered.add(catalogId);
    }
  }
  assert.equal(covered.size, 53);
});

test("usage scopes enforce first/once semantics, including across-player Belt Exam scope", () => {
  const mill = source.cards["DDB-LOC-CORE-004"].effects[0];
  const first = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-004" }, { ...satisfyingContext(mill), usedLocationEffectsThisRound: [] });
  assert.equal(first.length, 1);
  assert.deepEqual(locationUsageScopes(first[0]), ["round"]);
  const marked = markLocationCommandsUsed({ locationUsedEffectsThisRound: [] }, first);
  const second = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-004" }, { ...satisfyingContext(mill), ...locationUsageContext(marked) });
  assert.equal(second.length, 0);

  const demo = source.cards["DDB-LOC-CORE-046"].effects.find((effect) => effect.conditions?.some((condition) => condition.kind === "firstAcrossPlayersPerRound"));
  assert.ok(demo, "Demonstration across-player Belt Exam effect missing");
  const globalFirst = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-046" }, { ...satisfyingContext(demo), usedLocationEffectsAcrossPlayersThisRound: [] }).filter((command) => command.effectId === demo.id);
  assert.equal(globalFirst.length, 1);
  assert.deepEqual(locationUsageScopes(globalFirst[0]), ["acrossPlayersRound"]);
  const across = usedAcrossPlayersAfter(globalFirst);
  const globalSecond = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-046" }, { ...satisfyingContext(demo), usedLocationEffectsAcrossPlayersThisRound: across }).filter((command) => command.effectId === demo.id);
  assert.equal(globalSecond.length, 0);
});

test("Location lifecycle preserves scene-delayed state across Scene Change but expires turn/round state correctly", () => {
  const initial = {
    tempSpeed: 0,
    locationUsedEffectsThisTurn: ["turn"],
    locationUsedEffectsThisRound: ["round"],
    locationUsedEffectsThisScene: ["scene"],
    locationNextRoundSpeed: -2,
    locationStandingAttack: 1,
    locationStandingDefense: 1,
    locationChosenCounterZone: "Low",
    locationChosenCounterRound: 3,
    locationComboNumericChoice: "damage",
    locationEquipmentExhaustCountThisRound: 1,
    locationKataFlowGrantsThisTurn: 1,
    locationNextAttackFlowFromKata: true,
  };
  const nextScene = resetLocationScene(initial);
  assert.deepEqual(nextScene.locationUsedEffectsThisScene, []);
  assert.equal(nextScene.locationChosenCounterZone, "Low", "mid-round Scene Change must not erase the already-made Counterattack zone choice");

  const nextTurn = resetLocationTurn(nextScene);
  assert.deepEqual(nextTurn.locationUsedEffectsThisTurn, []);
  assert.deepEqual(nextTurn.locationUsedEffectsThisRound, ["round"]);
  assert.equal(nextTurn.locationChosenCounterZone, null);
  assert.equal(nextTurn.locationComboNumericChoice, null);
  assert.equal(nextTurn.locationKataFlowGrantsThisTurn, 0);
  assert.equal(nextTurn.locationNextAttackFlowFromKata, false);

  const nextRound = resetLocationRound(nextTurn);
  assert.deepEqual(nextRound.locationUsedEffectsThisRound, []);
  assert.equal(nextRound.tempSpeed, -2, "next-round delayed Speed applies at Honor");
  assert.equal(nextRound.locationNextRoundSpeed, 0);
  assert.equal(nextRound.locationEquipmentExhaustCountThisRound, 0);
});

test("representative structured Location effects mutate Quick Duel numeric state as printed", () => {
  const healing = locationRuntimeDelta([commandFor("DDB-LOC-CORE-003", "location-003-healing-penalty")]);
  assert.equal(Math.max(healing.healingMinimum, 3 + healing.healing), 2, "Back Alley reduces healing 3 to 2");

  const xp = locationRuntimeDelta([commandFor("DDB-LOC-CORE-004", "location-004-first-attack-defense-xp")]);
  assert.equal(1 + xp.xpGain, 2, "Backyard Belt Mill adds 1 XP to the first matching Attack/Defense XP award");

  const kata = locationRuntimeDelta([commandFor("DDB-LOC-CORE-037", "location-037-kata-focus-zero")]);
  assert.equal(kata.kataFocusSet, 0, "Parking Lot sets printed Kata Focus generation to zero");

  const ko = locationRuntimeDelta([commandFor("DDB-LOC-CORE-050", "location-050-ko-xp-plus")]);
  assert.equal(2 + ko.koXp, 3, "Underground Fight Club raises the standard KO XP award from 2 to 3");

  const reduction = locationRuntimeDelta([commandFor("DDB-LOC-CORE-019", "location-019-first-damage-reduction-plus")]);
  assert.equal(Math.max(0, 4 - (1 + reduction.damageReduction)), 2, "Furniture Showroom Maze adds 1 to a qualifying reduction");

  const combo = locationRuntimeDelta([commandFor("DDB-LOC-CORE-002", "location-002-first-combo-numeric-plus")]);
  assert.equal(combo.comboNumeric, 1, "Astral Training Plane exposes a +1 Combo numeric mutation");
});

test("Unattended Folding-Chair Warehouse only grants next-Defense Guard after exactly the first Equipment exhaust", () => {
  const effect = source.cards["DDB-LOC-CORE-049"].effects.find((candidate) => candidate.id === "location-049-first-equipment-exhaust-next-defense");
  assert.ok(effect);
  const first = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-049" }, { ...satisfyingContext(effect), equipmentExhaustedEarlierThisRound: true, firstEquipmentExhaustThisRound: true });
  assert.equal(locationRuntimeDelta(first).guard, 1);
  const second = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-049" }, { ...satisfyingContext(effect), equipmentExhaustedEarlierThisRound: true, firstEquipmentExhaustThisRound: false });
  assert.equal(second.length, 0);
});

test("Quick Duel supplies every non-usage predicate key required by the canonical Location registry", () => {
  for (const key of [
    "attackBlocked",
    "attackHit",
    "attackTagAny",
    "attackUsesEquipmentTagAny",
    "combatDamageDealt",
    "isComboFinisher",
    "sameRoundAsSceneChoice",
    "usesSceneChosenCounterZone",
    "afterThatConsumable",
    "attackIsUnarmed",
    "attackZone",
    "equipmentTagAny",
    "firstAttackThisTurn",
    "firstComboThisTurn",
    "firstConsumableUsedThisTurn",
    "firstHighAttackThisTurn",
    "firstKataFlowThisTurn",
    "firstLowAttackThisTurn",
    "hasWeaponEquipped",
    "isFastest",
    "itemPlayedBeforeFirstAttack",
    "kataGrantedFlowThisAttack",
    "incomingAttackZone",
    "comboIsLearned",
    "firstConsumableThisTurn",
    "reductionSourceAny",
    "defenseTagAny",
    "defenseZone",
    "equipmentExhaustedEarlierThisRound",
    "firstDefenseThisRound",
    "firstEquipmentExhaustThisRound",
    "selfSpeedAtLeast",
    "equipmentReadiedOutsideInitiate",
    "equippedCardTagAny",
    "ownTurn",
    "printedFocusAtLeast",
    "healingSourceAny",
    "firstKataThisTurn",
    "attackedThisTurn",
    "cardSubtypeOrTagAny",
    "cardTypeAny",
    "firstItemPurchaseThisAscend",
    "printedCostAtLeast",
    "isSlowest",
    "isKoXp",
    "xpSourceAny",
  ]) assert.match(playtestSource, new RegExp(`\\b${key}\\b`), `Quick Duel never supplies Location predicate ${key}`);
});

test("Quick Duel uses all Core Locations and no gameplay-critical Location rulesText parser", () => {
  assert.match(playtestSource, /quickDuelLocationPool\s*=\s*locationPool\.filter\(\(card\)\s*=>\s*card\.catalogId\.includes\("-LOC-CORE-"\)\)/);
  assert.doesNotMatch(playtestSource, /locationAttackRuleModifiers/);
  assert.doesNotMatch(playtestSource, /\blocationFocusModifier\s*\(/);
  assert.doesNotMatch(playtestSource, /location\.name\s*===/);
  assert.doesNotMatch(playtestSource, /\["Public Library",\s*"Strip-Mall McDojo"/);
  assert.doesNotMatch(resolverSource, /rulesText|normalizedMinus/);
  assert.match(playtestSource, /STAGE3D_LOCATION_RUNTIME_FINALIZED/);
});

test("Quick Duel exposes explicit Location lifecycle/event hooks for both fighters", () => {
  for (const hook of [
    "applyLocationSceneReveal",
    "applyLocationRoundStart",
    "applyLocationAfterAttack",
    "applyLocationBlock",
    "applyLocationConsumableResolve",
    "applyLocationEquipmentExhaust",
    "locationPurchasePrice",
    "applyLocationHealing",
    "applyLocationBeltExamComplete",
    "applyLocationComboTrigger",
  ]) assert.match(playtestSource, new RegExp(`\\b${hook}\\b`), `missing ${hook}`);
  assert.match(playtestSource, /usedLocationEffectsAcrossPlayersThisRound/);
});

test("human Location choices stay explicit while AI Location choices are deterministic", () => {
  for (const token of [
    "comboNumericChoice",
    "locationDrawDiscardChoice",
    "readyEquipmentOrSpeedChoice",
    "discardForReadyOrDefenseChoice",
    "nextCounterAttackChosenZone",
    "Choose +1 Speed instead",
    "Choose +1 DEF instead",
  ]) assert.match(playtestSource, new RegExp(token), `missing explicit human Location choice path ${token}`);
  assert.match(playtestSource, /function applyAiLocationChoice/);
  assert.match(playtestSource, /lowestFocusId/);
  assert.match(playtestSource, /locationComboNumericChoice/);
});
