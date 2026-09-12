import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("committed player Attack routes Combo gameplay through the canonical Playtest host", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  const resolvePlayerAttackState = (current: Match): Match => {");
  const end = source.indexOf("\n  const declareAttack =", start);
  assert.ok(start >= 0 && end > start, "player Attack function boundaries must remain discoverable");

  const playerAttack = source.slice(start, end);
  assert.match(playerAttack, /prepareQuickDuelPlaytestAttack\(current, "player", card, zone, cardFor, quickDuelHostOperations\)/);
  assert.match(playerAttack, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "onHit"/);
  assert.match(playerAttack, /hostQuickDuelPlaytestCardEvent\(hostedComboMatch, "player", card, zone, cardFor, "afterResolve"/);
  assert.doesNotMatch(playerAttack, /comboAttackModifier|comboModifier/, "player Attack must not retain a parallel Combo rulebook");

  const remainingLegacyAttackCalls = source.match(/comboAttackModifier\(current\./g) ?? [];
  assert.equal(remainingLegacyAttackCalls.length, 2, "only AI Attack and Reversal may remain on the legacy Combo path during this migration stage");
});
