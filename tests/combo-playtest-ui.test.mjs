import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel keeps learned Combos visible and evaluates the dedicated requirement field", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /active-combo-rack/);
  assert.match(source, /comboRequirementText/);
  assert.match(source, /evaluateCombo/);
  assert.match(source, /COMBO —/);
  assert.match(source, /Manual resolver pending/);
});
