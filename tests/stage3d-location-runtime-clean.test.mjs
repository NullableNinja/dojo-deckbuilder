import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { locationUsageScopes, resolveLocationEffects } from "../app/location-effect-resolvers.ts";
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
  resetLocationHostRound,
  resetLocationHostScene,
  resetLocationHostTurn,
  structuredLocationAttackForHost,
} from "../app/location-playtest-bridge.ts";

const source = JSON.parse(await readFile(new URL("../content/card-effects/locations.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8"));
const bridgeSource = await readFile(new URL("../app/location-playtest-bridge.ts", import.meta.url), "utf8");
const resolverSource = await readFile(new URL("../app/location-effect-resolvers.ts", import.meta.url), "utf8");
const canonical = cards.cards.filter((card) => card.cardType === "Location" && card.catalogId.includes("-LOC-CORE-"));

const metadataKinds = new Set([
  "locationOperation", "minimumFinalValue", "maximumFinalValue", "choiceOptions",
  "discardCount", "destroyCount", "drawCount", "focusGain", "hpLoss",
  "fixedValue", "maximumLoss", "appliesNextRound",
]);

function satisfyingContext(effect) {
  const context = {};
  for (const condition of effect.conditions ?? []) {
    const kind = String(condition.kind ?? "");
    if (!kind || metadataKinds.has(kind)) continue;
    const operator = condition.operator ?? "eq";
    if (operator === "neq") {
      context[kind] = typeof condition.value === "boolean" ? !condition.value : `not-${String(condition.value)}`;
    } else if (operator === "notIncludes") {
      context[kind] = [];
    } else {
      context[kind] = condition.value;
    }
  }
  return context;
}

function eventFor(effect) {
  return String((effect.conditions ?? []).find((condition) => condition.kind === "locationEvent")?.value ?? "");
}

function ownerForEffect(effectId) {
  const owner = Object.entries(source.cards).find(([, entry]) => entry.effects.some((candidate) => candidate.id === effectId));
  assert.ok(owner, `${effectId} missing canonical Location owner`);
  const [catalogId, entry] = owner;
  const effect = entry.effects.find((candidate) => candidate.id === effectId);
  assert.ok(effect, `${catalogId}/${effectId} missing canonical effect`);
  return { catalogId, effect };
}

function commandForEffect(effectId) {
  const { catalogId, effect } = ownerForEffect(effectId);
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
  assert.equal(Object.values(source.cards).reduce((total, entry) => total + entry.effects.length, 0), 99);
});

test("all 99 Location effects resolve from structured context and produce executable output", () => {
  const covered = new Set();
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    for (const effect of entry.effects) {
      const command = resolveLocationEffects({ catalogId }, satisfyingContext(effect)).find((candidate) => candidate.effectId === effect.id);
      assert.ok(command, `${catalogId}/${effect.id} did not resolve from structured predicates`);
      assert.ok(meaningfulDelta(locationRuntimeDelta([command])), `${catalogId}/${effect.id} has no executable runtime state/delta`);
      covered.add(catalogId);
    }
  }
  assert.equal(covered.size, 53);
});

test("usage scopes enforce first/once semantics including across-player round scope", () => {
  const mill = source.cards["DDB-LOC-CORE-004"].effects[0];
  const first = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-004" }, { ...satisfyingContext(mill), usedLocationEffectsThisRound: [] });
  assert.equal(first.length, 1);
  assert.deepEqual(locationUsageScopes(first[0]), ["round"]);
  const marked = markLocationCommandsUsed({ locationUsedEffectsThisRound: [] }, first);
  assert.equal(resolveLocationEffects({ catalogId: "DDB-LOC-CORE-004" }, { ...satisfyingContext(mill), ...locationUsageContext(marked) }).length, 0);

  const demo = source.cards["DDB-LOC-CORE-046"].effects.find((effect) => effect.conditions?.some((condition) => condition.kind === "firstAcrossPlayersPerRound"));
  assert.ok(demo);
  const globalFirst = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-046" }, { ...satisfyingContext(demo), usedLocationEffectsAcrossPlayersThisRound: [] }).filter((command) => command.effectId === demo.id);
  assert.equal(globalFirst.length, 1);
  assert.deepEqual(locationUsageScopes(globalFirst[0]), ["acrossPlayersRound"]);
  const across = usedAcrossPlayersAfter(globalFirst);
  const globalSecond = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-046" }, { ...satisfyingContext(demo), usedLocationEffectsAcrossPlayersThisRound: across }).filter((command) => command.effectId === demo.id);
  assert.equal(globalSecond.length, 0);
});

test("Location lifecycle preserves delayed state and clears the proper scopes", () => {
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
  assert.equal(turn.locationComboNumericChoice, null);
  const round = resetLocationRound(turn);
  assert.deepEqual(round.locationUsedEffectsThisRound, []);
  assert.equal(round.tempSpeed, -2);
  assert.equal(round.locationNextRoundSpeed, 0);
  assert.equal(round.locationEquipmentExhaustCountThisRound, 0);
});

test("representative Location effects mutate healing, XP, Kata, KO, reduction, and Combo values", () => {
  const healing = locationRuntimeDelta([commandForEffect("location-003-healing-penalty")]);
  assert.equal(Math.max(healing.healingMinimum, 3 + healing.healing), 2);
  assert.equal(1 + locationRuntimeDelta([commandForEffect("location-004-first-attack-defense-xp")]).xpGain, 2);
  assert.equal(locationRuntimeDelta([commandForEffect("location-037-kata-focus-zero")]).kataFocusSet, 0);
  assert.equal(2 + locationRuntimeDelta([commandForEffect("location-050-ko-xp-plus")]).koXp, 3);
  assert.equal(Math.max(0, 4 - (1 + locationRuntimeDelta([commandForEffect("location-019-first-damage-reduction-plus")]).damageReduction)), 2);
  assert.equal(locationRuntimeDelta([commandForEffect("location-002-first-combo-numeric-plus")]).comboNumeric, 1);
});

test("Haunted Dojo destroyCount is metadata, not a host predicate", () => {
  const command = commandForEffect("location-022-destroy-junk-focus-hp");
  assert.equal(command.operation, "destroyJunkGainFocusLoseHp");
  assert.equal(command.metadata.destroyCount, 1);
  assert.equal(command.metadata.focusGain, 2);
  assert.equal(command.metadata.hpLoss, 1);
  assert.ok(locationRuntimeDelta([command]).choices.some((choice) => choice.operation === "destroyJunkGainFocusLoseHp"));
});

test("Unattended Folding-Chair Warehouse triggers only on the first Equipment exhaust", () => {
  const effect = source.cards["DDB-LOC-CORE-049"].effects.find((candidate) => candidate.id === "location-049-first-equipment-exhaust-next-defense");
  assert.ok(effect);
  const first = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-049" }, { ...satisfyingContext(effect), equipmentExhaustedEarlierThisRound: true, firstEquipmentExhaustThisRound: true });
  assert.equal(locationRuntimeDelta(first).guard, 1);
  const second = resolveLocationEffects({ catalogId: "DDB-LOC-CORE-049" }, { ...satisfyingContext(effect), equipmentExhaustedEarlierThisRound: true, firstEquipmentExhaustThisRound: false });
  assert.equal(second.length, 0);
});

test("generic host bridge resolves canonical event vocabulary and tracks across-player usage", () => {
  const { catalogId, effect } = ownerForEffect("location-003-healing-penalty");
  const resolved = resolveLocationHostEvent({ catalogId }, {}, eventFor(effect), satisfyingContext(effect));
  assert.equal(resolved.delta.healing, -1);
  assert.ok(resolved.delta.commands.some((command) => command.effectId === effect.id));

  const demo = source.cards["DDB-LOC-CORE-046"].effects.find((candidate) => candidate.conditions?.some((condition) => condition.kind === "firstAcrossPlayersPerRound"));
  assert.ok(demo);
  const first = resolveLocationHostEvent({ catalogId: "DDB-LOC-CORE-046" }, {}, eventFor(demo), satisfyingContext(demo), []);
  assert.ok(first.usedAcrossPlayersThisRound.includes(demo.id));
  const second = resolveLocationHostEvent({ catalogId: "DDB-LOC-CORE-046" }, {}, eventFor(demo), satisfyingContext(demo), first.usedAcrossPlayersThisRound);
  assert.equal(second.delta.commands.filter((command) => command.effectId === demo.id).length, 0);
});

test("attack adapter maps generic host facts without card-specific semantics", () => {
  const result = structuredLocationAttackForHost({ catalogId: "DDB-LOC-CORE-001" }, { zone: "High", firstAttack: true, attackTags: ["Punch"], hasWeapon: false, equipmentTags: [] });
  assert.equal(typeof result.matched, "boolean");
  assert.equal(typeof result.power, "number");
  assert.equal(typeof result.damage, "number");
  assert.ok(Array.isArray(result.notes));
});

test("host lifecycle bridge delegates resets", () => {
  const state = { tempSpeed: 0, locationUsedEffectsThisTurn: ["turn"], locationUsedEffectsThisRound: ["round"], locationUsedEffectsThisScene: ["scene"], locationNextRoundSpeed: 1 };
  assert.deepEqual(resetLocationHostTurn(state).locationUsedEffectsThisTurn, []);
  assert.deepEqual(resetLocationHostScene(state).locationUsedEffectsThisScene, []);
  assert.deepEqual(resetLocationHostRound(state).locationUsedEffectsThisRound, []);
  assert.equal(resetLocationHostRound(state).tempSpeed, 1);
});

test("Location resolver and host bridge contain no printed-rules parser or card-specific Core ID branches", () => {
  assert.doesNotMatch(resolverSource, /rulesText|normalizedMinus/);
  assert.doesNotMatch(bridgeSource, /rulesText/);
  assert.doesNotMatch(bridgeSource, /DDB-LOC-CORE-/);
  assert.doesNotMatch(bridgeSource, /\.name\s*===/);
});
