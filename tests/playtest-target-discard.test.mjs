import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


test("forced target-discard Hit effects are resolved for both fighters", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /const targetDiscardCount = hit \? targetDiscardOnHitCount\(card\) : 0/);
  assert.match(source, /sourceFollowup: false/);
  assert.match(source, /pendingCombatContinuation: \{ remainingAiAttacks: pending\.remainingAiAttacks, reversalEligible: false \}/);
});
