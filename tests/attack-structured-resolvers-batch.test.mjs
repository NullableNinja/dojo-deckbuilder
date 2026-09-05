import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { effectPlanForCard } from "../app/card-effects.ts";
import {
  attackPiercing,
  conditionalAttackPowerBonus,
  optionalDiscardDrawChoice,
  readyEquipmentOnHit,
  targetNextAttackPenalty,
} from "../app/effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const registry = JSON.parse(await readFile(new URL("../app/data/card-effects.json", import.meta.url), "utf8"));
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const card = (catalogId) => {
  const found = byCatalogId.get(catalogId);
  assert.ok(found, `${catalogId} must exist in the runtime card catalog`);
  return found;
};

const piercingContext = (overrides = {}) => ({
  matchingArmor: false,
  targetEquipmentCount: 0,
  targetHasExhaustedEquipment: false,
  speedChangedThisRound: false,
  ...overrides,
});

const powerContext = (overrides = {}) => ({
  playedKata: false,
  firstAttack: false,
  matchingArmor: false,
  targetEquipmentCount: 0,
  ...overrides,
});

test("Attack structured batch has fourteen migrated Attack identities with no queued clauses", () => {
  const attackIds = Object.keys(registry.cards).filter((catalogId) => catalogId.startsWith("DDB-ATK-CORE-"));
  assert.equal(attackIds.length, 14);
  for (const catalogId of attackIds) {
    const plan = effectPlanForCard(card(catalogId), registry);
    assert.equal(plan.source, "structured", `${catalogId} should prefer structured behavior`);
    assert.deepEqual(plan.unsupported, [], `${catalogId} should not have queued structured clauses`);
  }
});

test("Aisle-Seven Sweep uses structured exhausted-equipment Piercing and ready-on-Hit", () => {
  const aisle = card("DDB-ATK-CORE-002");
  assert.equal(attackPiercing(aisle, piercingContext({ targetHasExhaustedEquipment: true })).amount, 1);
  assert.equal(attackPiercing(aisle, piercingContext({ targetHasExhaustedEquipment: false })).amount, 0);
  assert.equal(readyEquipmentOnHit(aisle), 1);
});

test("structured next-Attack penalties resolve with the canonical magnitudes", () => {
  assert.equal(targetNextAttackPenalty(card("DDB-ATK-CORE-007")), 1);
  assert.equal(targetNextAttackPenalty(card("DDB-ATK-CORE-035")), 2);
  assert.equal(targetNextAttackPenalty(card("DDB-ATK-CORE-060")), 1);
});

test("structured Piercing conditions evaluate from live combat context", () => {
  const centerline = card("DDB-ATK-CORE-009");
  assert.equal(attackPiercing(centerline, piercingContext({ matchingArmor: true })).amount, 2);
  assert.equal(attackPiercing(centerline, piercingContext()).amount, 0);

  const escalator = card("DDB-ATK-CORE-019");
  assert.equal(attackPiercing(escalator, piercingContext({ speedChangedThisRound: true })).amount, 1);
  assert.equal(attackPiercing(escalator, piercingContext()).amount, 0);
});

test("Hammerfist and Knee Strike use structured conditional power and Piercing", () => {
  const hammerfist = card("DDB-ATK-CORE-027");
  assert.equal(conditionalAttackPowerBonus(hammerfist, powerContext({ matchingArmor: true })).amount, 1);
  assert.equal(conditionalAttackPowerBonus(hammerfist, powerContext()).amount, 0);
  assert.equal(attackPiercing(hammerfist, piercingContext({ matchingArmor: true })).amount, 1);
  assert.equal(attackPiercing(hammerfist, piercingContext()).amount, 0);

  const kneeStrike = card("DDB-ATK-CORE-033");
  assert.equal(conditionalAttackPowerBonus(kneeStrike, powerContext({ targetEquipmentCount: 2 })).amount, 1);
  assert.equal(conditionalAttackPowerBonus(kneeStrike, powerContext({ targetEquipmentCount: 1 })).amount, 0);
  assert.equal(attackPiercing(kneeStrike, piercingContext({ targetEquipmentCount: 2 })).amount, 1);
  assert.equal(attackPiercing(kneeStrike, piercingContext({ targetEquipmentCount: 1 })).amount, 0);
});

test("Kata-gated Attack Power is structured for Reverse Punch, Superman Punch, and Tornado Round Kick", () => {
  for (const catalogId of ["DDB-ATK-CORE-049", "DDB-ATK-CORE-057", "DDB-ATK-CORE-065"]) {
    const attack = card(catalogId);
    assert.equal(conditionalAttackPowerBonus(attack, powerContext({ playedKata: true })).amount, 2, `${catalogId} should gain +2 after a Kata`);
    assert.equal(conditionalAttackPowerBonus(attack, powerContext({ playedKata: false })).amount, 0, `${catalogId} should not gain the bonus without a Kata`);
  }
});

test("Inside Crescent Kick's optional cycle is read from structured parameters", () => {
  assert.deepEqual(optionalDiscardDrawChoice(card("DDB-ATK-CORE-032")), { discard: 1, draw: 1 });
});

test("Superman Punch keeps its generic structured Hit cycle alongside dedicated power", () => {
  const plan = effectPlanForCard(card("DDB-ATK-CORE-057"), registry);
  assert.deepEqual(plan.effects, [
    { timing: "onHit", kind: "draw", amount: 1 },
    { timing: "onHit", kind: "discard", amount: 1 },
  ]);
  assert.deepEqual(plan.dedicated, ["attack.conditionalPower"]);
  assert.deepEqual(plan.unsupported, []);
});
