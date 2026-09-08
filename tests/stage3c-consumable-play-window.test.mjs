import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canPlayCoreConsumableInPhase, stage3cRestrictionBlocks } from "../app/stage3c-consumable-play-window.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);

test("Consumable surface timing distinguishes Yell, Anytime, incoming Reaction, and event-specific Reaction cards", () => {
  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-052"), "player-yell"), true); // Turn
  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-003"), "player-yell"), true); // Anytime
  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-030"), "player-yell"), false); // Ascend
  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-005"), "player-yell"), false); // Reaction

  for (const catalogId of ["DDB-CON-CORE-005", "DDB-CON-CORE-016", "DDB-CON-CORE-036", "DDB-CON-CORE-041", "DDB-CON-CORE-047"]) {
    assert.equal(canPlayCoreConsumableInPhase(card(catalogId), "defense-window"), true, `${catalogId} should be legal in an incoming Attack Reaction Window`);
  }
  for (const catalogId of ["DDB-CON-CORE-001", "DDB-CON-CORE-017", "DDB-CON-CORE-033", "DDB-CON-CORE-049"]) {
    assert.equal(canPlayCoreConsumableInPhase(card(catalogId), "defense-window"), false, `${catalogId} needs its specific event hook instead of the generic incoming-Attack window`);
  }
  assert.equal(canPlayCoreConsumableInPhase(card("DDB-CON-CORE-057"), "defense-window"), true); // Anytime
});

test("Stage 3C restrictions are shared rules, not UI-only disabling", () => {
  assert.equal(stage3cRestrictionBlocks(["attack"], "attack"), true);
  assert.equal(stage3cRestrictionBlocks(["consumable"], "consumable"), true);
  assert.equal(stage3cRestrictionBlocks([], "attack"), false);
});
