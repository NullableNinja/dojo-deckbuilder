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

test("all 99 Location effects can be selected by structured context without prose interpretation", () => {
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    for (const effect of entry.effects) {
      const commands = resolveLocationEffects({ catalogId }, satisfyingContext(effect));
      assert.ok(commands.some((command) => command.effectId === effect.id), `${catalogId}/${effect.id} did not resolve from its structured predicates`);
    }
  }
});

test("every canonical Location produces a meaningful executable runtime delta or explicit choice", () => {
  const covered = new Set();
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    for (const effect of entry.effects) {
      const command = resolveLocationEffects({ catalogId }, satisfyingContext(effect)).find((candidate) => candidate.effectId === effect.id);
      assert.ok(command, `${catalogId}/${effect.id} missing command`);
      const delta = locationRuntimeDelta([command]);
      assert.ok(meaningfulDelta(delta), `${catalogId}/${effect.id} has no executable runtime state/delta`);
      covered.add(catalogId);
    }
  }
  assert.equal(covered.size, 53);
});

test("usage scopes enforce first/once semantics deterministically", () => {
  const mill = source.cards["DDB-LOC-CORE-004"].effects[0];
  const firstContext = { ...satisfyingContext(mill), usedLocationEffectsThisRound: [] };
  const first = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-004" }, firstContext);
  assert.equal(first.length, 1);
  assert.deepEqual(locationUsageScopes(first[0]), ["round"]);
  const marked = markLocationCommandsUsed({ locationUsedEffectsThisRound: [] }, first);
  const second = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-004" }, { ...satisfyingContext(mill), ...locationUsageContext(marked) });
  assert.equal(second.length, 0);

  const demo = source.cards["DDB-LOC-CORE-046"].effects.find((effect) => effect.id === "location-046-first-player-belt-exam-draw");
  assert.ok(demo, "Demonstration across-player Belt Exam effect missing");
  const globalFirst = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-046" }, { ...satisfyingContext(demo), usedLocationEffectsAcrossPlayersThisRound: [] })
    .filter((command) => command.effectId === demo.id);
  assert.equal(globalFirst.length, 1);
  assert.deepEqual(locationUsageScopes(globalFirst[0]), ["acrossPlayersRound"]);
  const across = usedAcrossPlayersAfter(globalFirst);
  const globalSecond = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-046" }, { ...satisfyingContext(demo), usedLocationEffectsAcrossPlayersThisRound: across })
    .filter((command) => command.effectId === demo.id);
  assert.equal(globalSecond.length, 0);
});

test("Location lifecycle reset keeps delayed state but clears turn/round/scene usage at the correct boundaries", () => {
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
  };
  const nextTurn = resetLocationTurn(initial);
  assert.deepEqual(nextTurn.locationUsedEffectsThisTurn, []);
  assert.deepEqual(nextTurn.locationUsedEffectsThisRound, ["round"]);

  const nextScene = resetLocationScene(nextTurn);
  assert.deepEqual(nextScene.locationUsedEffectsThisScene, []);
  assert.equal(nextScene.locationChosenCounterZone, "Low", "explicit delayed counter state survives a mid-round Scene Change");

  const nextRound = resetLocationRound(nextScene);
  assert.deepEqual(nextRound.locationUsedEffectsThisRound, []);
  assert.equal(nextRound.tempSpeed, -2, "next-round delayed Speed applies at Honor");
  assert.equal(nextRound.locationNextRoundSpeed, 0);
});

test("Quick Duel uses all Core Locations and gameplay no longer calls the legacy Location rulesText parser", () => {
  assert.match(playtestSource, /quickDuelLocationPool\s*=\s*locationPool\.filter\(\(card\)\s*=>\s*card\.catalogId\.includes\("-LOC-CORE-"\)\)/);
  assert.doesNotMatch(playtestSource, /locationAttackRuleModifiers/);
  assert.doesNotMatch(playtestSource, /location\.name\s*===/);
  assert.doesNotMatch(playtestSource, /\["Public Library",\s*"Strip-Mall McDojo"/);
  assert.doesNotMatch(resolverSource, /rulesText|normalizedMinus/);
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
    "locationHealingAmount",
    "applyLocationBeltExamComplete",
  ]) assert.match(playtestSource, new RegExp(`\\b${hook}\\b`), `missing ${hook}`);
  assert.match(playtestSource, /usedLocationEffectsAcrossPlayersThisRound/);
});
