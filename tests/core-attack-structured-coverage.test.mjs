import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const attackSourceText = await readFile(new URL("../content/card-effects/attacks.json", import.meta.url), "utf8");
const attackFamily = JSON.parse(attackSourceText);
const registry = attackFamily.cards ?? {};
const unifiedRegistry = JSON.parse(await readFile(new URL("../content/card-effects.json", import.meta.url), "utf8")).cards ?? {};

const coreAttacks = cards.filter((card) => String(card.catalogId ?? "").startsWith("DDB-ATK-CORE-"));
const familyIds = Object.keys(registry);

test("Attack family registry has the canonical Stage 3B metadata", () => {
  assert.equal(attackFamily.schemaVersion, 1);
  assert.equal(attackFamily.rulesVersion, "v2.3");
  assert.equal(attackFamily.rulesRevision, "v2.3-r5");
  assert.equal(attackFamily.family, "Attack");
});

test("all 71 Core Attacks have exactly one family structured-effect entry", () => {
  assert.equal(coreAttacks.length, 71, "canonical Core Attack inventory changed; review the Stage 3B coverage invariant");
  assert.equal(familyIds.length, 71, "Attack family registry must contain exactly the 71 canonical Core Attacks");
  assert.deepEqual(
    familyIds.filter((catalogId) => !catalogId.startsWith("DDB-ATK-CORE-")),
    [],
    "Attack family registry must not contain another card family",
  );

  const missing = coreAttacks.filter((card) => !registry[card.catalogId]);
  assert.deepEqual(
    missing.map((card) => `${card.catalogId} ${card.name}`),
    [],
    "every Core Attack must remain represented in content/card-effects/attacks.json",
  );

  const declaredCatalogIds = [...attackSourceText.matchAll(/"(DDB-ATK-CORE-\d{3})"\s*:/g)].map((match) => match[1]);
  assert.equal(declaredCatalogIds.length, 71, "Attack family source must declare exactly 71 Catalog ID keys");
  assert.equal(new Set(declaredCatalogIds).size, declaredCatalogIds.length, "Attack family source contains a duplicate Catalog ID key");
});

test("Core Attack structured-effect names exactly match the canonical catalog", () => {
  const mismatches = coreAttacks
    .filter((card) => registry[card.catalogId]?.name !== card.name)
    .map((card) => ({
      catalogId: card.catalogId,
      catalogName: card.name,
      structuredName: registry[card.catalogId]?.name,
    }));

  assert.deepEqual(mismatches, []);
});

test("every migrated Core Attack keeps an explicit executable effects array", () => {
  const invalid = coreAttacks
    .filter((card) => !Array.isArray(registry[card.catalogId]?.effects))
    .map((card) => card.catalogId);
  assert.deepEqual(invalid, []);
});

test("Attack family source preserves the currently integrated Attack semantics", () => {
  const integratedAttackSubset = Object.fromEntries(coreAttacks.map((card) => [card.catalogId, unifiedRegistry[card.catalogId]]));
  assert.deepEqual(registry, integratedAttackSubset);
});
