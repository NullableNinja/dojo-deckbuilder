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
  assert.deepEqual(plan.dedicated, []);
  assert.deepEqual(plan.unsupported, []);
});

test("conditional structured effects require a condition-aware resolver", () => {
  const plan = effectPlanForCard({
    rulesText: "Draw 99 cards.",
    effects: [
      {
        id: "conditional-draw",
        trigger: "onHit",
        action: "draw",
        target: "self",
        amount: 1,
        conditions: [{ kind: "firstAttackThisTurn", operator: "eq", value: true }],
      },
    ],
  });
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, []);
  assert.deepEqual(plan.dedicated, []);
  assert.deepEqual(plan.unsupported, ["conditional-draw"]);
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
  assert.deepEqual(plan.dedicated, []);
  assert.deepEqual(plan.unsupported, ["special"]);
});

test("Starter cards resolve through the canonical structured-effect registry", async () => {
  const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
  const registry = JSON.parse(await readFile(new URL("../app/data/card-effects.json", import.meta.url), "utf8"));
  const coverage = effectCoverage(cards, registry);
  assert.equal(coverage.total, 589);
  assert.equal(coverage.structured, 11, "All eleven Starter card identities should be structurally migrated");
  assert.ok(coverage.full > 0, "Expected at least one completely resolved printed effect");
  assert.ok(coverage.partial > 0, "Expected mixed clauses to remain visible as partial coverage outside the Starter family");
  assert.equal(coverage.full + coverage.partial + coverage.queued, coverage.total);

  const breathing = cards.find((card) => card.catalogId === "DDB-STA-CORE-005");
  const breathingPlan = effectPlanForCard(breathing, registry);
  assert.equal(breathingPlan.source, "structured");
  assert.deepEqual(breathingPlan.effects, [
    { timing: "onPlay", kind: "nextAttackPower", amount: 1 },
  ]);
  assert.deepEqual(breathingPlan.dedicated, []);
  assert.deepEqual(breathingPlan.unsupported, []);

  // playtest.tsx still calls compileCardEffects(card.rulesText) for the generic
  // effect subset. The bridge resolves exact canonical Starter text through the
  // generated registry before the English parser gets a chance.
  const bridgedBreathingPlan = compileCardEffects(breathing.rulesText);
  assert.equal(bridgedBreathingPlan.source, "structured");
  assert.deepEqual(bridgedBreathingPlan.effects, [
    { timing: "onPlay", kind: "nextAttackPower", amount: 1 },
  ]);
  assert.deepEqual(bridgedBreathingPlan.dedicated, []);
  assert.deepEqual(bridgedBreathingPlan.unsupported, []);

  const badHabit = cards.find((card) => card.catalogId === "DDB-STA-CORE-001");
  const badHabitPlan = effectPlanForCard(badHabit, registry);
  assert.equal(badHabitPlan.source, "structured");
  assert.deepEqual(badHabitPlan.effects, []);
  assert.deepEqual(badHabitPlan.dedicated, []);
  assert.deepEqual(badHabitPlan.unsupported, []);

  const footwork = cards.find((card) => card.catalogId === "DDB-STA-CORE-008");
  const footworkPlan = effectPlanForCard(footwork, registry);
  assert.equal(footworkPlan.source, "structured");
  assert.deepEqual(footworkPlan.effects, [
    { timing: "onPlay", kind: "speed", amount: 2 },
  ]);
  assert.deepEqual(footworkPlan.dedicated, ["starter.gainFocusIfFastest"]);
  assert.deepEqual(footworkPlan.unsupported, []);
  const bridgedFootworkPlan = compileCardEffects(footwork.rulesText);
  assert.equal(bridgedFootworkPlan.source, "structured");
  assert.deepEqual(bridgedFootworkPlan.effects, [
    { timing: "onPlay", kind: "speed", amount: 2 },
  ]);
  assert.deepEqual(bridgedFootworkPlan.dedicated, ["starter.gainFocusIfFastest"]);
  assert.deepEqual(bridgedFootworkPlan.unsupported, []);

  const wildSwing = cards.find((card) => card.catalogId === "DDB-STA-CORE-011");
  const wildSwingPlan = effectPlanForCard(wildSwing, registry);
  assert.equal(wildSwingPlan.source, "structured");
  assert.deepEqual(wildSwingPlan.effects, []);
  assert.deepEqual(wildSwingPlan.dedicated, ["attack.chooseAnyZone"]);
  assert.deepEqual(wildSwingPlan.unsupported, []);
});

test("choice language is never auto-executed by the generic parser", () => {
  const plan = compileCardEffects("After this Attack resolves, you may discard 1 card to draw 1 card.");
  assert.deepEqual(plan.effects, []);
  assert.equal(plan.unsupported.length, 1);
  const choose = compileCardEffects("Choose one card. Draw 2 cards.");
  assert.deepEqual(choose.effects, [{ timing: "onPlay", kind: "draw", amount: 2 }]);
  assert.equal(choose.unsupported.length, 1);
});
