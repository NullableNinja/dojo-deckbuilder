import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SUPPORTED_LOCATION_OPERATIONS,
  isStructuredLocation,
  resolveLocationEffects,
  structuredLocationAttackModifiers,
  structuredLocationDefenseGuardModifier,
  structuredLocationHealingModifier,
  structuredLocationKataFocusModifier,
  structuredLocationPurchaseCostModifier,
} from "../app/location-effect-resolvers.ts";

const source = JSON.parse(await readFile(new URL("../content/card-effects/locations.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8"));
const generated = JSON.parse(await readFile(new URL("../app/data/card-effects.json", import.meta.url), "utf8"));
const resolverSource = await readFile(new URL("../app/location-effect-resolvers.ts", import.meta.url), "utf8");

const canonical = cards.cards.filter((card) => card.cardType === "Location" && card.catalogId.includes("-LOC-CORE-"));
const canonicalById = new Map(canonical.map((card) => [card.catalogId, card]));

test("Location family registry exactly covers the 53 canonical Core Locations", () => {
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.rulesVersion, "v2.3");
  assert.equal(source.rulesRevision, "v2.3-r5");
  assert.equal(source.family, "Location");
  assert.equal(canonical.length, 53);
  assert.deepEqual(Object.keys(source.cards).sort(), canonical.map((card) => card.catalogId).sort());
});

test("Location names match the canonical catalog and every clause has executable structured semantics", () => {
  const ids = new Set();
  let effectCount = 0;
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    assert.equal(entry.name, canonicalById.get(catalogId)?.name);
    assert.ok(Array.isArray(entry.effects) && entry.effects.length > 0, `${catalogId} has no effects`);
    for (const effect of entry.effects) {
      effectCount += 1;
      assert.ok(effect.id, `${catalogId} has an effect without an id`);
      assert.ok(!ids.has(effect.id), `duplicate effect id ${effect.id}`);
      ids.add(effect.id);
      assert.equal(effect.resolver, "location.structured");
      assert.ok(effect.action, `${catalogId}/${effect.id} has no action`);
      const operation = effect.conditions?.find((condition) => condition.kind === "locationOperation")?.value;
      if (effect.action === "custom") {
        assert.equal(typeof operation, "string", `${catalogId}/${effect.id} custom effect has no Location operation`);
        assert.ok(SUPPORTED_LOCATION_OPERATIONS.has(operation), `${catalogId}/${effect.id} uses unsupported operation ${operation}`);
      }
    }
  }
  assert.equal(effectCount, 99);
});

test("generated registry preserves the authored Location semantics exactly", () => {
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    assert.deepEqual(generated.cards[catalogId], entry);
  }
});

test("Location runtime is structured-data-first and never parses printed rules prose", () => {
  assert.doesNotMatch(resolverSource, /rulesText|normalizedMinus|\.match\s*\(/);
  for (const [catalogId, entry] of Object.entries(source.cards)) {
    assert.ok(isStructuredLocation({ catalogId, name: entry.name }));
  }
});

test("Quick Duel scene attack modifiers execute from structured data", () => {
  const cityBus = structuredLocationAttackModifiers(
    { catalogId: "DDB-LOC-CORE-007" },
    { attackZone: "Mid", firstAttackThisTurn: true, attackTagAny: [], equipmentTagAny: [] },
  );
  assert.equal(cityBus.power, 1);

  const garage = structuredLocationAttackModifiers(
    { catalogId: "DDB-LOC-CORE-036" },
    { attackZone: "Low", firstLowAttackThisTurn: true, attackTagAny: ["Spin"], equipmentTagAny: [] },
  );
  assert.equal(garage.power, 2);

  const yoga = structuredLocationAttackModifiers(
    { catalogId: "DDB-LOC-CORE-053" },
    { attackZone: "High", firstAttackThisTurn: true, attackTagAny: [], equipmentTagAny: [] },
  );
  assert.equal(yoga.power, -1);
});

test("Location defense, healing, purchase, and Kata modifiers execute from structured data", () => {
  const busDefense = structuredLocationDefenseGuardModifier(
    { catalogId: "DDB-LOC-CORE-007" },
    { defenseTagAny: ["Dodge"], defenseZone: "Mid" },
  );
  assert.equal(busDefense.guard, -1);

  const backAlleyHeal = structuredLocationHealingModifier(
    { catalogId: "DDB-LOC-CORE-003" },
    { healingSourceAny: ["Consumable"] },
  );
  assert.equal(backAlleyHeal.amount, -1);
  assert.equal(backAlleyHeal.minimum, 1);

  const farmersHeal = structuredLocationHealingModifier(
    { catalogId: "DDB-LOC-CORE-017" },
    { healingSourceAny: ["Consumable"] },
  );
  assert.equal(farmersHeal.amount, 2);

  const conferenceDiscount = structuredLocationPurchaseCostModifier(
    { catalogId: "DDB-LOC-CORE-011" },
    { cardTypeAny: ["Item"], firstMatchingPerTurn: true },
  );
  assert.equal(conferenceDiscount.amount, -1);
  assert.equal(conferenceDiscount.minimum, 1);

  const dojoKata = structuredLocationKataFocusModifier(
    { catalogId: "DDB-LOC-CORE-048" },
    { firstKataThisTurn: true },
  );
  assert.equal(dojoKata.bonus, 1);
});

test("bespoke Location branches emit explicit commands instead of prose fallbacks", () => {
  const haunted = resolveLocationEffects(
    { catalogId: "DDB-LOC-CORE-022" },
    { locationEvent: "manualSceneAction", oncePerTurn: true },
  );
  assert.equal(haunted.length, 1);
  assert.equal(haunted[0].operation, "destroyJunkGainFocusLoseHp");
  assert.equal(haunted[0].metadata.focusGain, 2);
  assert.equal(haunted[0].metadata.hpLoss, 1);

  const fireExit = resolveLocationEffects(
    { catalogId: "DDB-LOC-CORE-018" },
    { locationEvent: "block", oncePerRound: true },
  );
  assert.equal(fireExit[0]?.action, "chooseZone");
  assert.equal(fireExit[0]?.operation, "nextCounterAttackChosenZone");
});
