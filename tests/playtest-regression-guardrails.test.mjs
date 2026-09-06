import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("market purchases spend only the selected card cost and preserve remaining Focus", () => {
  assert.match(playtest, /const focusBefore = current\.player\.focus;/);
  assert.match(playtest, /const price = marketPriceFor\(current\.player, card\)/);
  assert.match(playtest, /spendFocus\(current\.player, price\)/);
  assert.match(playtest, /Bought \$\{card\.name\} for \$\{price\} Focus \(\$\{focusBefore\} → \$\{nextPlayer\.focus\}\)/);
});

test("a played Defense card is consumed by the strike it resolves", () => {
  assert.match(playtest, /hand:\s*removeOne\(nextPlayer\.hand, defenseCard\.id\)/);
  assert.match(playtest, /discard:\s*\[\.\.\.nextPlayer\.discard, defenseCard\.id\]/);
  assert.match(playtest, /if \(pending\.remainingAiAttacks\.length\) return openAiStrike/);
});

test("player discard effects remain explicit choices instead of silent auto-discard", () => {
  assert.match(playtest, /if \(owner === "player" && \(timing === "onPlay" \|\| timing === "onBlock"\)\) continue;/);
  assert.match(playtest, /pendingChoice:\s*\{ kind: "discard-hand"/);
  assert.match(playtest, /Choose what to discard/);
});

test("Quick Duel belt promotion changes rank without changing current or Max HP", () => {
  const promotion = playtest.match(/function applyBeltPromotion\(board: Board, beltIndex: number\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(promotion, /return \{ \.\.\.board, belt: beltIndex \};/);
  assert.doesNotMatch(promotion, /maxHpIncrease|board\.hp \+ 5|maxHp,/);
});
