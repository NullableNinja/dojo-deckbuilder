import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { effectPlanForCard } from "../app/card-effects.ts";
import { comboPlanForHost } from "../app/combo-playtest-bridge.ts";
import { isSupportedComboResolver, structuredComboEffects } from "../app/combo-runtime.ts";

const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards ?? [];
const registry = JSON.parse(await readFile(new URL("../app/data/card-effects.json", import.meta.url), "utf8"));
const cardsByCatalogId = new Map(cards.map((card) => [card.catalogId, card]));

test("every canonical structured-effect entry resolves as structured data, never card prose", () => {
  const failures = [];
  for (const catalogId of Object.keys(registry.cards ?? {})) {
    const card = cardsByCatalogId.get(catalogId);
    if (!card) {
      failures.push(`${catalogId}: missing generated canonical card`);
      continue;
    }
    const plan = effectPlanForCard(card, registry);
    if (plan.source !== "structured") failures.push(`${catalogId}: resolved through ${plan.source}`);
  }
  assert.deepEqual(failures, []);
});

test("structured effects override contradictory printed prose", () => {
  const plan = effectPlanForCard({
    rulesText: "Draw 99 cards and gain 99 Focus.",
    effects: [
      { id: "canonical-draw", trigger: "onPlay", action: "draw", target: "self", amount: 1 },
    ],
  });
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, [{ timing: "onPlay", kind: "draw", amount: 1 }]);
  assert.deepEqual(plan.unsupported, []);
});

test("unsupported structured behavior stays explicit instead of falling back to prose", () => {
  const plan = effectPlanForCard({
    rulesText: "Draw 99 cards.",
    effects: [
      { id: "canonical-custom", trigger: "onPlay", action: "custom", resolver: "test.pendingResolver" },
    ],
  });
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, []);
  assert.deepEqual(plan.unsupported, ["canonical-custom"]);
});

test("canonical Combo effects are covered by the generic Combo host", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(registry.cards ?? {})) {
    if (!catalogId.includes("-CMB-")) continue;
    const combo = cardsByCatalogId.get(catalogId);
    const effects = structuredComboEffects(combo ?? catalogId);
    for (const effect of effects) {
      if (effect.resolver && !isSupportedComboResolver(effect.resolver)) {
        failures.push(`${catalogId}/${effect.id}: unsupported resolver ${effect.resolver}`);
      }
    }
    if (!combo) {
      failures.push(`${catalogId}: missing canonical card`);
      continue;
    }
    const plan = comboPlanForHost(combo, {
      priorCards: [],
      currentCard: combo,
      currentZone: "Mid",
      zonesPlayed: [],
      equipment: [],
      attacksThisTurn: 0,
      hitThisTurn: false,
      blockedThisRound: false,
      defendedThisRound: false,
    });
    assert.deepEqual(plan.unsupportedEffectIds, [], `${catalogId} has effects not projected by the Combo host`);
  }
  assert.deepEqual(failures, []);
});

test("effect coverage recognizes all completed Combo and Reaction Item resolver contracts", () => {
  const plans = cards
    .filter((card) => card.catalogId?.includes("-CMB-") || card.catalogId?.includes("-RIT-"))
    .map((card) => ({ card, plan: effectPlanForCard(card, registry) }));
  assert.equal(plans.length, 67);
  assert.deepEqual(
    plans.filter(({ plan }) => plan.unsupported.length).map(({ card }) => card.catalogId),
    [
      "DDB-RIT-CORE-004",
      "DDB-RIT-CORE-005",
      "DDB-RIT-CORE-006",
      "DDB-RIT-CORE-007",
      "DDB-RIT-CORE-008",
      "DDB-RIT-CORE-009",
      "DDB-RIT-CORE-010",
    ],
  );
});
