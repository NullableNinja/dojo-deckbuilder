import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playtest = await readFile(new URL("app/playtest.tsx", root), "utf8");

function ordered(source, first, second, label) {
  const left = source.indexOf(first);
  const right = source.indexOf(second);
  assert.ok(left >= 0, `${label}: missing ${first}`);
  assert.ok(right >= 0, `${label}: missing ${second}`);
  assert.ok(left < right, `${label}: expected ${first} before ${second}`);
}

test("Market price preview composes Character pricing after existing non-Character modifiers", () => {
  const start = playtest.indexOf("function marketBasePriceFor");
  const end = playtest.indexOf("function marketFocusAvailable", start);
  assert.ok(start >= 0 && end > start);
  const pricing = playtest.slice(start, end);
  assert.match(pricing, /qualifiedNextPurchaseDiscount/);
  assert.match(pricing, /stage3cPurchaseCostModifier/);
  assert.match(pricing, /previewQuickDuelCharacterPurchasePrice\(board, marketBasePriceFor\(board, card\)\)/);
});

test("player Market purchase commits Character purchaseAttempt before spending Focus and moving the card", () => {
  const start = playtest.indexOf("const buyMarket =");
  const end = playtest.indexOf("const completeTurn =", start);
  assert.ok(start >= 0 && end > start);
  const purchase = playtest.slice(start, end);
  ordered(purchase, "commitQuickDuelCharacterPurchase(", "spendMarketFocus(", "player Market purchase");
  ordered(purchase, "spendMarketFocus(", "refillPurchasedMarketSlot(", "player Market purchase");
  assert.match(purchase, /ai: characterPurchase\.opponent/);
});

test("AI Market purchase commits the same Character purchaseAttempt before spending Focus", () => {
  const start = playtest.indexOf("function finishAiTurn");
  const end = playtest.indexOf("function ", start + 1);
  assert.ok(start >= 0);
  const purchase = playtest.slice(start, end > start ? end : undefined);
  ordered(purchase, "commitQuickDuelCharacterPurchase(", "spendMarketFocus(", "AI Market purchase");
  assert.match(purchase, /playerAfterPurchase = characterPurchase\?\.opponent \?\? current\.player/);
});

test("all live Market purchase surfaces use Character price preview and successful commit", () => {
  assert.ok((playtest.match(/previewQuickDuelCharacterPurchasePrice\(/g) ?? []).length >= 2);
  assert.ok((playtest.match(/commitQuickDuelCharacterPurchase\(/g) ?? []).length >= 3, "row, raffle, and AI purchases commit the canonical event");
  assert.match(playtest, /marketFocusAvailable\(player, card\) >= marketPriceFor\(player, card\)/);
});
