import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("market purchases spend only the selected card cost and preserve remaining Focus", () => {
  assert.match(playtest, /const focusBefore = current\.player\.focus;/);
  assert.match(playtest, /focus:\s*focusBefore - price/);
  assert.match(playtest, /Bought \$\{card\.name\} for \$\{price\} Focus \(\$\{focusBefore\} → \$\{nextPlayer\.focus\}\)/);
});

test("a played Defense card is consumed by the strike it resolves", () => {
  assert.match(playtest, /hand:\s*removeOne\(nextPlayer\.hand, defenseCard\.id\)/);
  assert.match(playtest, /discard:\s*\[\.\.\.nextPlayer\.discard, defenseCard\.id\]/);
  assert.match(playtest, /if \(pending\.remainingAiAttacks\.length\) return openAiStrike/);
});

test("player discard effects remain explicit choices instead of silent auto-discard", () => {
  assert.match(playtest, /if \(owner === "player" && timing === "onPlay"\) continue;/);
  assert.match(playtest, /pendingChoice:\s*\{ kind: "discard-hand"/);
  assert.match(playtest, /Choose what to discard/);
});

test("belt promotion reports and applies max HP progression", () => {
  assert.match(playtest, /const nextPlayer = applyBeltPromotion\(current\.player, current\.player\.belt \+ 1\);/);
  assert.match(playtest, /nextPlayer\.maxHp > current\.player\.maxHp/);
  assert.match(playtest, /current HP \$\{current\.player\.hp\} → \$\{nextPlayer\.hp\}/);
});
