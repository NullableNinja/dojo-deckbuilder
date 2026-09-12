import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

function sliceBetween(sourceText, startMarker, endMarker) {
  const start = sourceText.indexOf(startMarker);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);

  const end = sourceText.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing end marker after ${startMarker}: ${endMarker}`);

  return sourceText.slice(start, end);
}

test("AI Air Horn cancels a player Reaction Consumable before structured effects resolve and returns both Consumables to supply", () => {
  const playSupport = sliceBetween(source, "const playSupport =", "const practiceDefense =");
  const cancellation = playSupport.indexOf("if (aiAirHorn)");
  const applyEffects = playSupport.indexOf("applyCardEffects(supportEntryBoard");
  assert.ok(cancellation >= 0 && applyEffects > cancellation, "Air Horn interception must happen before the target Reaction resolves");
  assert.match(playSupport, /cancelledPlayer = returnResolvedConsumable\(cancelledPlayer, card\)/, "cancelled Consumable must follow the canonical supply lifecycle");
  assert.match(playSupport, /reactingAi = returnResolvedConsumable\(reactingAi, aiAirHorn\)/, "Air Horn must follow the canonical supply lifecycle");
  const cancellationBlock = playSupport.slice(cancellation, applyEffects);
  assert.doesNotMatch(cancellationBlock, /discard: \[...current.player.discard, card.id\]/, "cancelled Consumable must not be incorrectly sent to the fighter discard pile");
});

test("AI Air Horn spends a player Defense before Guard/effects without resolving Defense or Block lifecycle", () => {
  const resolveDefenseState = sliceBetween(source, "const resolveDefenseState =", "const resolveDefense =");
  const cancellation = resolveDefenseState.indexOf("if (aiAirHorn)");
  const defenseMath = resolveDefenseState.indexOf("const matchingArmor");
  assert.ok(cancellation >= 0 && defenseMath > cancellation, "Air Horn must intercept the played Defense before defense math/effects");
  const cancellationBlock = resolveDefenseState.slice(cancellation, defenseMath);
  assert.match(cancellationBlock, /hand: removeOne\(current\.player\.hand, defenseCard\.id\)/, "cancelled Defense must leave the hand");
  assert.match(cancellationBlock, /discard: \[\.\.\.current\.player\.discard, defenseCard\.id\]/, "cancelled Defense must go to discard");
  assert.match(cancellationBlock, /return resolveDefenseState\(intercepted, null, prevention, skipOptionalPrompt\)/, "the strike must resume with no Defense card after cancellation");
  assert.doesNotMatch(cancellationBlock, /stage3cConsumeDefenseStatuses/);
  assert.doesNotMatch(cancellationBlock, /markCompletedTask/);
  assert.doesNotMatch(cancellationBlock, /\bxp:/);
  assert.doesNotMatch(cancellationBlock, /defendedThisRound/);
  assert.doesNotMatch(cancellationBlock, /playedDefenseSinceLastTurn/);
  assert.doesNotMatch(cancellationBlock, /nextDefenseCardBonus/);
  assert.doesNotMatch(cancellationBlock, /blockedSinceLastTurn|blockedThisRound/);
});
