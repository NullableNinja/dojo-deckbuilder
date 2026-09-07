import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizePendingDamageChoice } from "../app/playtest-state-recovery.ts";

test("stale persisted damage prompt is cleared when its strike already resolved", () => {
  const recovered = normalizePendingDamageChoice({
    phase: "ai-ready",
    pendingStrike: null,
    pendingChoice: { kind: "prevent-combat-damage" },
    log: ["existing"],
  });

  assert.equal(recovered.pendingChoice, null);
  assert.equal(recovered.phase, "ai-ready");
  assert.match(recovered.log[0], /Recovered a stale damage-prevention prompt/);
});

test("interrupted damage prompt restores the only phase in which it can resolve", () => {
  const strike = { cardId: "attack" };
  const recovered = normalizePendingDamageChoice({
    phase: "ai-ready",
    pendingStrike: strike,
    pendingChoice: { kind: "prevent-combat-damage" },
    log: [],
  });

  assert.equal(recovered.pendingStrike, strike);
  assert.equal(recovered.phase, "defense-window");
  assert.equal(recovered.pendingChoice?.kind, "prevent-combat-damage");
});

test("valid pending damage decision is unchanged", () => {
  const current = {
    phase: "defense-window",
    pendingStrike: { cardId: "attack" },
    pendingChoice: { kind: "prevent-combat-damage" },
    log: [],
  };
  assert.equal(normalizePendingDamageChoice(current), current);
});

test("Quick Duel normalizes persisted and live damage decisions before the resolver guard", async () => {
  const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(playtest, /validSavedMatch \? normalizePendingDamageChoice\(validSavedMatch\) : null/);
  assert.match(
    playtest,
    /resolveDefenseState[\s\S]{0,1800}pendingChoice\?\.kind === "prevent-combat-damage"[\s\S]{0,250}current = normalizePendingDamageChoice\(current\)[\s\S]{0,250}!current\?\.pendingStrike \|\| current\.phase !== "defense-window"/,
  );
});
