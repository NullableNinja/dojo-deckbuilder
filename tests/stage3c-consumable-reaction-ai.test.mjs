import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aiDefensiveConsumableScore, chooseAiDefensiveConsumable } from "../app/stage3c-consumable-reaction-ai.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);

test("AI considers the five incoming-combat Reaction Consumables legal defensive candidates", () => {
  for (const catalogId of ["DDB-CON-CORE-005", "DDB-CON-CORE-016", "DDB-CON-CORE-036", "DDB-CON-CORE-041", "DDB-CON-CORE-047"]) {
    assert.ok(aiDefensiveConsumableScore(card(catalogId), { missingHp: 5, expectedIncomingDamage: 4, friendlyTargetCount: 1, opponentTargetCount: 1 }) > 0, catalogId);
  }
});

test("AI ignores event-specific Reactions that do not belong to the incoming-Attack defensive window", () => {
  for (const catalogId of ["DDB-CON-CORE-001", "DDB-CON-CORE-017", "DDB-CON-CORE-033", "DDB-CON-CORE-049"]) {
    assert.equal(aiDefensiveConsumableScore(card(catalogId), { missingHp: 5, expectedIncomingDamage: 4 }), Number.NEGATIVE_INFINITY, catalogId);
  }
});

test("AI deterministically selects the highest-value legal defensive Consumable instead of random reaction use", () => {
  const hand = [card("DDB-CON-CORE-016"), card("DDB-CON-CORE-005"), card("DDB-CON-CORE-041")];
  const selected = chooseAiDefensiveConsumable(hand, { missingHp: 0, expectedIncomingDamage: 4, friendlyTargetCount: 1, opponentTargetCount: 1 });
  assert.equal(selected?.catalogId, "DDB-CON-CORE-005");
  const wounded = chooseAiDefensiveConsumable(hand, { missingHp: 5, expectedIncomingDamage: 1, friendlyTargetCount: 1, opponentTargetCount: 1 });
  assert.equal(wounded?.catalogId, "DDB-CON-CORE-016");
});
