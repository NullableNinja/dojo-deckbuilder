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

test("player Air Horn pauses the declared Attack before an AI Consumable Reaction resolves", () => {
  const resolver = sliceBetween(source, "const resolvePlayerAttackState =", "const declareAttack =");
  const candidate = resolver.indexOf("const aiConsumableCandidate");
  const autoResolve = resolver.indexOf("const aiConsumableReaction =");
  assert.ok(candidate >= 0 && autoResolve > candidate);
  const interruption = resolver.slice(candidate, autoResolve);
  assert.ok(interruption.includes('pendingChoice: { kind: "air-horn-reaction"'));
  assert.ok(interruption.includes('reactionKind: "consumable"'));
  assert.ok(resolver.includes("airHornAiConsumableSpentThisStrike"));
  assert.ok(resolver.includes("Air Horn canceled the computer's Consumable Reaction"));
});

test("player Air Horn can cancel the AI's one Defense without allowing a replacement Defense", () => {
  const resolver = sliceBetween(source, "const resolvePlayerAttackState =", "const declareAttack =");
  assert.ok(resolver.includes("const defenseId = current.airHornAiDefenseSpentThisStrike"));
  assert.ok(resolver.includes("? null"));
  assert.ok(resolver.includes(": bestDefense"));
  assert.ok(resolver.includes('reactionKind: "defense"'));
  const handler = sliceBetween(source, "const resolvePlayerAirHornChoice =", "const playSupport =");
  assert.ok(handler.includes("airHornAiDefenseSpentThisStrike = true"));
  assert.ok(handler.includes("return resolvePlayerAttackState(intercepted)"));
});

test("canceled AI Defense is spent but does not resolve Defense or Block lifecycle", () => {
  const handler = sliceBetween(source, "const resolvePlayerAirHornChoice =", "const playSupport =");
  const start = handler.indexOf('if (choice.reactionKind === "consumable")');
  const end = handler.indexOf("airHornAiDefenseSpentThisStrike = true", start);
  assert.ok(start >= 0 && end > start);
  const defenseCancellation = handler.slice(start, end);
  assert.ok(defenseCancellation.includes("hand: removeOne(ai.hand, reaction.id)"));
  assert.ok(defenseCancellation.includes("discard: [...ai.discard, reaction.id]"));
  assert.doesNotMatch(defenseCancellation, /stage3cConsumeDefenseStatuses/);
  assert.doesNotMatch(defenseCancellation, /markCompletedTask/);
  assert.doesNotMatch(defenseCancellation, /\bxp:/);
  assert.doesNotMatch(defenseCancellation, /defendedThisRound/);
  assert.doesNotMatch(defenseCancellation, /playedDefenseSinceLastTurn/);
  assert.doesNotMatch(defenseCancellation, /nextDefenseCardBonus/);
});

test("Air Horn player choice preserves Consumable lifecycle destinations", () => {
  const handler = sliceBetween(source, "const resolvePlayerAirHornChoice =", "const playSupport =");
  assert.ok(handler.includes("player = returnResolvedConsumable(player, airHorn)"));
  assert.ok(handler.includes("cancelledAi = returnResolvedConsumable(cancelledAi, reaction)"));
});

test("Air Horn choice is an explicit two-button Dojo Stack decision", () => {
  assert.ok(source.includes("Sound the Air Horn?"));
  assert.ok(source.includes("resolvePlayerAirHornChoice(true)"));
  assert.ok(source.includes("USE AIR HORN"));
  assert.ok(source.includes("resolvePlayerAirHornChoice(false)"));
  assert.ok(source.includes("ALLOW REACTION"));
});
