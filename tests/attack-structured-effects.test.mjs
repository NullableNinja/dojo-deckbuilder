import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileCardEffects, effectPlanForCard } from "../app/card-effects.ts";

const load = async () => {
  const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
  const registry = JSON.parse(await readFile(new URL("../app/data/card-effects.json", import.meta.url), "utf8"));
  return { cards, registry };
};

test("Flying Knee executes its Hit draw from structured data", async () => {
  const { cards, registry } = await load();
  const card = cards.find((candidate) => candidate.catalogId === "DDB-ATK-CORE-023");
  assert.ok(card, "Flying Knee must exist in the canonical runtime catalog");
  const plan = effectPlanForCard(card, registry);
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, [{ timing: "onHit", kind: "draw", amount: 1 }]);
  assert.deepEqual(plan.dedicated, []);
  assert.deepEqual(plan.unsupported, []);

  const playtestBridge = compileCardEffects(card.rulesText);
  assert.equal(playtestBridge.source, "structured");
  assert.deepEqual(playtestBridge.effects, [{ timing: "onHit", kind: "draw", amount: 1 }]);
  assert.deepEqual(playtestBridge.unsupported, []);
});

test("Pop-up Roundhouse Hit draw/discard executes from structured data", async () => {
  const { cards, registry } = await load();
  const card = cards.find((candidate) => candidate.catalogId === "DDB-ATK-CORE-042");
  assert.ok(card, "Pop-up Roundhouse Kick must exist in the canonical runtime catalog");
  const expected = [
    { timing: "onHit", kind: "draw", amount: 1 },
    { timing: "onHit", kind: "discard", amount: 1 },
  ];
  const plan = effectPlanForCard(card, registry);
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, expected);
  assert.deepEqual(plan.dedicated, []);
  assert.deepEqual(plan.unsupported, []);

  const playtestBridge = compileCardEffects(card.rulesText);
  assert.equal(playtestBridge.source, "structured");
  assert.deepEqual(playtestBridge.effects, expected);
  assert.deepEqual(playtestBridge.unsupported, []);
});
