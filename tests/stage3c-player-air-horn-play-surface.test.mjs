import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");

test("player Air Horn pauses the declared Attack before an AI Consumable Reaction resolves", () => {
  const resolver = source.slice(source.indexOf("const resolvePlayerAttackState ="), source.indexOf("const declareAttack ="));
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
  const resolver = source.slice(source.indexOf("const resolvePlayerAttackState ="), source.indexOf("const declareAttack ="));
  assert.ok(resolver.includes("const defenseId = current.airHornAiDefenseSpentThisStrike"));
  assert.ok(resolver.includes("? null"));
  assert.ok(resolver.includes(": bestDefense"));
  assert.ok(resolver.includes('reactionKind: "defense"'));
  const handler = source.slice(source.indexOf("const resolvePlayerAirHornChoice ="), source.indexOf("const playSupport ="));
  assert.ok(handler.includes("airHornAiDefenseSpentThisStrike = true"));
  assert.ok(handler.includes("return resolvePlayerAttackState(intercepted)"));
});

test("Air Horn player choice preserves normal lifecycle destinations", () => {
  const handler = source.slice(source.indexOf("const resolvePlayerAirHornChoice ="), source.indexOf("const playSupport ="));
  assert.ok(handler.includes("player = returnResolvedConsumable(player, airHorn)"));
  assert.ok(handler.includes("cancelledAi = returnResolvedConsumable(cancelledAi, reaction)"));
  assert.ok(handler.includes("discard: [...ai.discard, reaction.id]"));
  assert.ok(handler.includes("stage3cConsumeDefenseStatuses(markCompletedTask"));
});

test("Air Horn choice is an explicit two-button Dojo Stack decision", () => {
  assert.ok(source.includes("Sound the Air Horn?"));
  assert.ok(source.includes("resolvePlayerAirHornChoice(true)"));
  assert.ok(source.includes("USE AIR HORN"));
  assert.ok(source.includes("resolvePlayerAirHornChoice(false)"));
  assert.ok(source.includes("ALLOW REACTION"));
});
