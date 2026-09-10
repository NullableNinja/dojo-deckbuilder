import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { locationAttackRuleModifiers } from "../app/effect-resolvers.ts";
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
import {
  resolveLocationHostEvent,
  structuredLocationAttackForHost,
} from "../app/location-playtest-bridge.ts";

const source = JSON.parse(await readFile(new URL("../content/card-effects/locations.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8"));
const resolverSource = await readFile(new URL("../app/location-effect-resolvers.ts", import.meta.url), "utf8");
const bridgeSource = await readFile(new URL("../app/location-playtest-bridge.ts", import.meta.url), "utf8");

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

function commandForEffect(effectId) {
  const owner = Object.entries(source.cards).find(([, entry]) => entry.effects.some((candidate) => candidate.id === effectId));
  assert.ok(owner, `${effectId} missing canonical Location owner`);
  const [catalogId, entry] = owner;
  const effect = entry.effects.find((candidate) => candidate.id === effectId);
  const command = resolveLocationEffects({ catalogId }, { ...satisfyingContext(effect), locationEvent: effect.trigger })
    .find((candidate) => candidate.effectId === effect.id);
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
  assert.equal(Object.values(source.cards).reduce((total, entry) => total + entry.effects.length, 0), 99);
});

test("all 99 Location effects select from structured context without prose interpretation", () => {
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    for (const effect of entry.effects) {
      const commands = resolveLocationEffects(
        { catalogId },
        { ...satisfyingContext(effect), locationEvent: effect.trigger },
      );
      assert.ok(commands.some((command) => command.effectId === effect.id), `${catalogId}/${effect.id} did not resolve`);
    }
  }
});

test("every Core Location effect produces executable runtime state/delta or an explicit choice", () => {
  const covered = new Set();
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    for (const effect of entry.effects) {
      const command = resolveLocationEffects(
        { catalogId },
        { ...satisfyingContext(effect), locationEvent: effect.trigger },
      ).find((candidate) => candidate.effectId === effect.id);
      assert.ok(command, `${catalogId}/${effect.id} missing command`);
      assert.ok(meaningfulDelta(locationRuntimeDelta([command])), `${catalogId}/${effect.id} has no executable runtime delta`);
      covered.add(catalogId);
    }
  }
  assert.equal(covered.size, 53);
});

test("usage scopes enforce first/once semantics including across-player round scope", () => {
  const effect = source.cards["DDB-LOC-CORE-004"].effects[0];
  const first = resolveLocationEffects(
    { catalogId: "DDB-LOC-CORE-004" },
    { ...satisfyingContext(effect), locationEvent: effect.trigger, usedLocationEffectsThisRound: [] },
  );
  assert.equal(first.length, 1);
  assert.deepEqual(locationUsageScopes(first[0]), ["round"]);
  const marked = markLocationCommandsUsed({ locationUsedEffectsThisRound: [] }, first);
  const second = resolveLocationEffects(
    { catalogId: "DDB-LOC-CORE-004" },
    { ...satisfyingContext(effect), locationEvent: effect.trigger, ...locationUsageContext(marked) },
  );
  assert.equal(second.length, 0);

  const demo = source.cards["DDB-LOC-CORE-046"].effects.find((candidate) =>
    candidate.conditions?.some((condition) => condition.kind === "firstAcrossPlayersPerRound"));
  assert.ok(demo);
  const globalFirst = resolveLocationEffects(
    { catalogId: "DDB-LOC-CORE-046" },
    { ...satisfyingContext(demo), locationEvent: demo.trigger, usedLocationEffectsAcrossPlayersThisRound: [] },
  ).filter((command) => command.effectId === demo.id);
  assert.equal(globalFirst.length, 1);
  assert.deepEqual(locationUsageScopes(globalFirst[0]), ["acrossPlayersRound"]);
  const globalSecond = resolveLocationEffects(
    { catalogId: "DDB-LOC-CORE-046" },
    { ...satisfyingContext(demo), locationEvent: demo.trigger, usedLocationEffectsAcrossPlayersThisRound: usedAcrossPlayersAfter(globalFirst) },
  ).filter((command) => command.effectId === demo.id);
  assert.equal(globalSecond.length, 0);
});

test("Location lifecycle expires turn/round/scene state at the correct boundary", () => {
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
  const scene = resetLocationScene(initial);
  assert.deepEqual(scene.locationUsedEffectsThisScene, []);
  assert.equal(scene.locationChosenCounterZone, "Low");
  const turn = resetLocationTurn(scene);
  assert.deepEqual(turn.locationUsedEffectsThisTurn, []);
  assert.deepEqual(turn.locationUsedEffectsThisRound, ["round"]);
  assert.equal(turn.locationChosenCounterZone, null);
  const round = resetLocationRound(turn);
  assert.deepEqual(round.locationUsedEffectsThisRound, []);
  assert.equal(round.tempSpeed, -2);
  assert.equal(round.locationNextRoundSpeed, 0);
});

test("representative structured Location effects mutate numeric gameplay state as printed", () => {
  const healing = locationRuntimeDelta([commandForEffect("location-003-healing-penalty")]);
  assert.equal(Math.max(healing.healingMinimum, 3 + healing.healing), 2);
  const xp = locationRuntimeDelta([commandForEffect("location-004-first-attack-defense-xp")]);
  assert.equal(1 + xp.xpGain, 2);
  const kata = locationRuntimeDelta([commandForEffect("location-037-kata-focus-zero")]);
  assert.equal(kata.kataFocusSet, 0);
  const ko = locationRuntimeDelta([commandForEffect("location-050-ko-xp-plus")]);
  assert.equal(2 + ko.koXp, 3);
  const reduction = locationRuntimeDelta([commandForEffect("location-019-first-damage-reduction-plus")]);
  assert.equal(Math.max(0, 4 - (1 + reduction.damageReduction)), 2);
});

test("thin Location host bridge resolves canonical commands and tracks usage without card-specific logic", () => {
  const state = { locationUsedEffectsThisTurn: [], locationUsedEffectsThisRound: [], locationUsedEffectsThisScene: [] };
  const effect = source.cards["DDB-LOC-CORE-030"].effects.find((candidate) => candidate.trigger === "attack");
  assert.ok(effect);
  const resolution = resolveLocationHostEvent(
    { catalogId: "DDB-LOC-CORE-030" },
    state,
    "attack",
    satisfyingContext(effect),
  );
  assert.ok(resolution.delta.commands.some((command) => command.effectId === effect.id));
  assert.equal(resolution.delta.attackPower, -1);
});

test("existing Quick Duel attack host transparently routes Core Locations through the structured bridge", () => {
  const context = { zone: "High", firstAttack: true, attackTags: [], hasWeapon: false, equipmentTags: [] };
  const direct = structuredLocationAttackForHost({ catalogId: "DDB-LOC-CORE-030" }, context);
  const throughHost = locationAttackRuleModifiers({ catalogId: "DDB-LOC-CORE-030" }, context);
  assert.deepEqual(throughHost, direct);
  assert.equal(throughHost.power, -1);
});

test("Location resolver and host bridge contain no printed-prose or card-ID special cases", () => {
  assert.doesNotMatch(resolverSource, /rulesText|normalizedMinus|location\.name\s*===/);
  assert.doesNotMatch(bridgeSource, /rulesText|location\.name\s*===|DDB-LOC-CORE-/);
});
