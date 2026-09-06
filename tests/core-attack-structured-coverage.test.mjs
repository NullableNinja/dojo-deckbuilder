import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const registry = JSON.parse(await readFile(new URL("../content/card-effects.json", import.meta.url), "utf8")).cards ?? {};

const coreAttacks = cards.filter((card) => String(card.catalogId ?? "").startsWith("DDB-ATK-CORE-"));

test("all 71 Core Attacks have canonical structured-effect entries", () => {
  assert.equal(coreAttacks.length, 71, "canonical Core Attack inventory changed; review the Stage 3B coverage invariant");

  const missing = coreAttacks.filter((card) => !registry[card.catalogId]);
  assert.deepEqual(
    missing.map((card) => `${card.catalogId} ${card.name}`),
    [],
    "every Core Attack must remain represented in content/card-effects.json",
  );
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
