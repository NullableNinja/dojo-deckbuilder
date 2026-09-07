import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("resolved incoming damage choice is cleared before combat continues", () => {
  assert.match(
    playtest,
    /Tempo \+1 Guard[\s\S]{0,1200}pendingStrike:\s*null,\s*pendingChoice:\s*null,\s*pendingCombatContinuation:\s*null/,
    "resolveDefenseState must clear the consumed pendingChoice when the strike is finalized",
  );
});

test("both optional damage buttons re-enter resolution without reopening the prompt", () => {
  assert.match(playtest, /usePendingEquipmentChoice[\s\S]{0,700}resolveDefenseState\(current, choice\.defenseId,[\s\S]{0,350}, true\)/);
  assert.match(playtest, /skipPendingChoice[\s\S]{0,500}resolveDefenseState\(current, choice\.defenseId, null, true\)/);
});
