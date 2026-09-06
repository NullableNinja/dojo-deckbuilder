import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const family = JSON.parse(await readFile(new URL("../content/card-effects/equipment.json", import.meta.url), "utf8"));
const effectsVocabulary = JSON.parse(await readFile(new URL("../content/effects.json", import.meta.url), "utf8"));
const unifiedRegistry = JSON.parse(await readFile(new URL("../content/card-effects.json", import.meta.url), "utf8")).cards ?? {};
const registry = family.cards ?? {};

function isCoreEquipment(card) {
  const catalogId = String(card.catalogId ?? "").toUpperCase();
  const subtype = String(card.subtype ?? "").toLowerCase();
  return catalogId.includes("-CORE-") && (
    catalogId.includes("-WPN-") ||
    catalogId.includes("-GEA-") ||
    catalogId.includes("-DEQ-") ||
    ["weapon", "gear", "defense equipment"].includes(subtype)
  );
}

const coreEquipment = cards.filter(isCoreEquipment);
const canonicalIds = coreEquipment.map((card) => card.catalogId).sort();
const registryIds = Object.keys(registry).sort();

test("Core Equipment canonical inventory is exactly 135 cards", () => {
  assert.equal(coreEquipment.length, 135);
  const bySubtype = new Map();
  for (const card of coreEquipment) bySubtype.set(card.subtype, (bySubtype.get(card.subtype) ?? 0) + 1);
  assert.equal(bySubtype.get("Weapon"), 65);
  assert.equal(bySubtype.get("Gear"), 24);
  assert.equal(bySubtype.get("Defense Equipment"), 46);
  assert.equal(new Set(canonicalIds).size, canonicalIds.length, "canonical Equipment Catalog IDs must be unique");
});

test("Equipment family registry metadata and Catalog-ID coverage are exact", () => {
  assert.equal(family.$schema, "../card-effect-family.schema.json");
  assert.equal(family.schemaVersion, 1);
  assert.equal(family.rulesVersion, "v2.3");
  assert.equal(family.rulesRevision, "v2.3-r5");
  assert.equal(family.family, "Equipment");
  assert.equal(registryIds.length, 135);
  assert.deepEqual(registryIds, canonicalIds);
});

test("every Core Equipment entry preserves canonical identity and has executable structured semantics", () => {
  const effectIds = [];
  const canonicalEffects = new Set(Object.keys(effectsVocabulary.effects ?? {}));
  const canonicalConditions = new Set(Object.keys(effectsVocabulary.conditions ?? {}));

  for (const card of coreEquipment) {
    const entry = registry[card.catalogId];
    assert.ok(entry, `missing Equipment registry entry for ${card.catalogId}`);
    assert.equal(entry.name, card.name, `${card.catalogId} must preserve canonical card name`);
    assert.ok(Array.isArray(entry.effects) && entry.effects.length > 0, `${card.catalogId} must have structured effects`);

    for (const effect of entry.effects) {
      assert.ok(effect.id, `${card.catalogId} effect must have an id`);
      assert.ok(effect.effect, `${card.catalogId}/${effect.id} must reference canonical effect vocabulary`);
      assert.ok(canonicalEffects.has(effect.effect), `${card.catalogId}/${effect.id} uses unknown effect ${effect.effect}`);
      assert.equal(effect.resolver, "equipment.structured", `${card.catalogId}/${effect.id} must route through the Equipment structured resolver`);
      effectIds.push(effect.id);
      for (const condition of effect.conditions ?? []) {
        assert.ok(canonicalConditions.has(condition.kind), `${card.catalogId}/${effect.id} uses unknown condition ${condition.kind}`);
      }
    }
  }

  assert.equal(new Set(effectIds).size, effectIds.length, "Equipment effect IDs must be globally unique within the family");
});

test("generated unified registry contains exactly the authored Equipment semantics", () => {
  for (const catalogId of canonicalIds) {
    assert.ok(unifiedRegistry[catalogId], `generated unified registry missing ${catalogId}`);
    assert.equal(unifiedRegistry[catalogId].name, registry[catalogId].name);
    assert.equal(unifiedRegistry[catalogId].effects.length, registry[catalogId].effects.length, `${catalogId} effect count changed during generation`);
    assert.deepEqual(
      unifiedRegistry[catalogId].effects.map((effect) => effect.id),
      registry[catalogId].effects.map((effect) => effect.id),
      `${catalogId} effect identity changed during generation`,
    );
  }
});
