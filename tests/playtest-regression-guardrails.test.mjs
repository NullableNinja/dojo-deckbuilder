import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const playtest = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const characterPurchaseHost = await readFile(new URL("../app/quick-duel-character-purchase-host.ts", import.meta.url), "utf8");

test("market purchases route effective Character pricing through the purchase host and preserve remaining Focus", () => {
  assert.match(playtest, /const focusBefore = current\.player\.focus;/);
  assert.match(playtest, /const basePrice = marketBasePriceFor\(current\.player, card\);/);
  assert.match(playtest, /const price = previewQuickDuelCharacterPurchasePrice\(current\.player, basePrice\);/);
  assert.match(playtest, /const characterPurchase = commitQuickDuelCharacterPurchase\(current\.player, current\.ai, card, basePrice, "player"\);/);
  assert.match(playtest, /spendMarketFocus\(characterPurchase\.self, card, characterPurchase\.price\)/);
  assert.match(playtest, /Bought \$\{card\.name\} for \$\{characterPurchase\.price\} Focus \(\$\{focusBefore\} → \$\{nextPlayer\.focus\}\)/);
  assert.match(characterPurchaseHost, /characterPurchasePrice\(board, composedPrice\)/);
  assert.match(characterPurchaseHost, /publishQuickDuelCharacterEvent\(/);
  assert.match(characterPurchaseHost, /type: "purchaseAttempt"/);
  assert.doesNotMatch(playtest, /characterPurchasePrice\(/, "playtest.tsx must delegate Character pricing to the dedicated purchase host");
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
  assert.match(promotion, /return gainFocus\(\{ \.\.\.board, belt: beltIndex \}, rank\?\.reward\.onPromotionFocus \?\? 0\);/);
  assert.doesNotMatch(promotion, /maxHpIncrease|board\.hp \+ 5|maxHp,/);
});
