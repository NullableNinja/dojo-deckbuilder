import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("AI Air Horn cancels a player Reaction Consumable before structured effects resolve and returns both Consumables to supply", () => {
  const playSupport = source.slice(source.indexOf("const playSupport ="), source.indexOf("const useDefensePractice ="));
  const cancellation = playSupport.indexOf("if (aiAirHorn)");
  const applyEffects = playSupport.indexOf("applyCardEffects(supportEntryBoard");
  assert.ok(cancellation >= 0 && applyEffects > cancellation, "Air Horn interception must happen before the target Reaction resolves");
  assert.match(playSupport, /cancelledPlayer = returnResolvedConsumable\(cancelledPlayer, card\)/, "cancelled Consumable must follow the canonical supply lifecycle");
  assert.match(playSupport, /reactingAi = returnResolvedConsumable\(reactingAi, aiAirHorn\)/, "Air Horn must follow the canonical supply lifecycle");
  const cancellationBlock = playSupport.slice(cancellation, applyEffects);
  assert.doesNotMatch(cancellationBlock, /discard: \[...current.player.discard, card.id\]/, "cancelled Consumable must not be incorrectly sent to the fighter discard pile");
});

test("AI Air Horn cancels a player Defense before Guard and printed effects resolve, then resumes the strike with no Defense card", () => {
  const start = source.indexOf("const resolveDefenseState =");
  const end = source.indexOf("const resolveDefense =", start);
  const resolveDefenseState = source.slice(start, end);
  const cancellation = resolveDefenseState.indexOf("if (aiAirHorn)");
  const defenseMath = resolveDefenseState.indexOf("const matchingArmor");
  assert.ok(cancellation >= 0 && defenseMath > cancellation, "Air Horn must intercept the played Defense before defense math/effects");
  assert.match(resolveDefenseState, /discard: \[...current.player.discard, defenseCard.id\]/, "cancelled Defense must still leave the hand and go to its normal discard destination");
  assert.match(resolveDefenseState, /return resolveDefenseState\(intercepted, null, prevention, skipOptionalPrompt\)/, "the strike must resume with no Defense card after cancellation");
});
