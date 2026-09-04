import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel applies zonal equipment, destroy-after-use, and target debuffs", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /equipmentDefenseModifier\(current\.ai, zone\)/);
  assert.match(source, /equipmentDefenseModifier\(nextPlayer, pending\.zone\)/);
  assert.match(source, /applyAfterDefenseEquipment/);
  assert.match(source, /applyTargetHitDebuffs/);
  assert.match(source, /destroyResolvedConsumable/);
  assert.match(source, /Destroyed after use; it will not enter your discard pile/);
});


test("Quick Duel wires printed Attack/Defense modifiers and flexible zones into combat math", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /printedAttackRuleModifier/);
  assert.match(source, /defenseCardRuleModifier/);
  assert.match(source, /attackHasFlexibleZone/);
  assert.match(source, /locationAttackRuleModifiers/);
  assert.match(source, /conditionalHealAfterHit/);
});


test("Quick Duel pauses for explicit player-choice effects instead of auto-resolving them", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /type PendingChoice/);
  assert.match(source, /kind: "destroy-junk"/);
  assert.match(source, /kind: "discard-draw"/);
  assert.match(source, /resolvePendingChoice/);
  assert.match(source, /Skip this optional effect/);
  assert.match(source, /effect-choice-dialog/);
});
