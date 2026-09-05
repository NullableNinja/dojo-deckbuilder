import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileCardEffects, effectCoverage, effectPlanForCard } from "../app/card-effects.ts";

test("effect registry does not execute conditional Block text when a card is merely played", () => {
  const plan = compileCardEffects("If this Blocks, draw 1 card, then discard 1 card.");
  assert.deepEqual(plan.effects, [
    { timing: "onBlock", kind: "draw", amount: 1 },
    { timing: "onBlock", kind: "discard", amount: 1 },
  ]);
});

test("effect registry compiles common immediate resource effects", () => {
  const plan = compileCardEffects("Draw 2 cards, then lose 1 Speed until end of round. Gain 1 Focus.");
  assert.deepEqual(plan.effects, [
    { timing: "onPlay", kind: "draw", amount: 2 },
    { timing: "onPlay", kind: "speed", amount: -1 },
    { timing: "onPlay", kind: "focus", amount: 1 },
  ]);
  assert.deepEqual(plan.unsupported, []);
});

test("effect registry recognizes Hit and resolution timing", () => {
  const plan = compileCardEffects("If this Attack Hits, gain 1 Focus. After this resolves, heal 2 HP.");
  assert.deepEqual(plan.effects, [
    { timing: "onHit", kind: "focus", amount: 1 },
    { timing: "afterResolve", kind: "heal", amount: 2 },
  ]);
});

test("structured effects take precedence over prose and map into the compatibility plan", () => {
  const plan = effectPlanForCard({
    rulesText: "Draw 99 cards.",
    effects: [
      { id: "draw-one", trigger: "onPlay", action: "draw", target: "self", amount: 1 },
      { id: "next-hit", trigger: "onHit", action: "modifyAttackPower", target: "self", amount: 2, duration: "nextAttack" },
    ],
  });
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, [
    { timing: "onPlay", kind: "draw", amount: 1 },
    { timing: "onHit", kind: "nextAttackPower", amount: 2 },
  ]);
  assert.deepEqual(plan.unsupported, []);
});

test("structured effects never fall back to prose when a dedicated resolver is still pending", () => {
  const plan = effectPlanForCard({
    rulesText: "Draw 5 cards.",
    effects: [
      { id: "special", trigger: "onPlay", action: "custom", resolver: "starter.special" },
    ],
  });
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, []);
  assert.deepEqual(plan.unsupported, ["special"]);
});

test("effect coverage reports the current v2.3 catalog without pretending unsupported clauses work", async () => {
  const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
  const coverage = effectCoverage(cards);
  assert.equal(coverage.total, 589);
  assert.equal(coverage.structured, 0, "Stage 3B starts with zero migrated cards until canonical records are explicitly converted");
  assert.ok(coverage.full > 0, "Expected at least one completely resolved printed effect");
  assert.ok(coverage.partial > 0, "Expected mixed clauses to remain visible as partial coverage");
  assert.equal(coverage.full + coverage.partial + coverage.queued, coverage.total);
});

test("choice language is never auto-executed by the generic parser", () => {
  const plan = compileCardEffects("After this Attack resolves, you may discard 1 card to draw 1 card.");
  assert.deepEqual(plan.effects, []);
  assert.equal(plan.unsupported.length, 1);
  const choose = compileCardEffects("Choose one card. Draw 2 cards.");
  assert.deepEqual(choose.effects, [{ timing: "onPlay", kind: "draw", amount: 2 }]);
  assert.equal(choose.unsupported.length, 1);
});
