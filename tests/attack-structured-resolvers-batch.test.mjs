import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { effectPlanForCard } from "../app/card-effects.ts";
import {
  attackCanChooseAnyZone,
  attackPiercing,
  conditionalAttackPowerBonus,
  optionalDiscardDrawChoice,
  readyEquipmentOnHit,
  structuredConditionalFocus,
  structuredCurrentAttackFlow,
  structuredNextAttackAnyZone,
  structuredNextAttackFlow,
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

const FIRST_BATCH_IDS = [
  "DDB-ATK-CORE-002",
  "DDB-ATK-CORE-007",
  "DDB-ATK-CORE-009",
  "DDB-ATK-CORE-019",
  "DDB-ATK-CORE-023",
  "DDB-ATK-CORE-027",
  "DDB-ATK-CORE-032",
  "DDB-ATK-CORE-033",
  "DDB-ATK-CORE-035",
  "DDB-ATK-CORE-042",
  "DDB-ATK-CORE-049",
  "DDB-ATK-CORE-057",
  "DDB-ATK-CORE-060",
  "DDB-ATK-CORE-065",
];

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

test("first Attack resolver batch remains structured with no queued clauses", () => {
  const attackIds = Object.keys(registry.cards).filter((catalogId) => catalogId.startsWith("DDB-ATK-CORE-"));
  assert.ok(attackIds.length >= 40, "Attack migration should not regress below the completed structured batches");
  for (const catalogId of FIRST_BATCH_IDS) {
    assert.ok(attackIds.includes(catalogId), `${catalogId} must remain in the structured registry`);
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

test("Helmet Check ignores up to 2 matching Armor DEF from structured data", () => {
  const helmetCheck = card("DDB-ATK-CORE-028");
  const plan = effectPlanForCard(helmetCheck, registry);
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.unsupported, []);
  assert.equal(attackPiercing(helmetCheck, piercingContext({ matchingArmor: true })).amount, 2);
  assert.equal(attackPiercing(helmetCheck, piercingContext()).amount, 0);
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

const nextFlowContext = (overrides = {}) => ({
  timing: "afterResolve",
  differentZoneFromPreviousAttack: false,
  ...overrides,
});

test("Flow-granting Attack batch is structured and executable", () => {
  const ids = ["DDB-ATK-CORE-005", "DDB-ATK-CORE-053", "DDB-ATK-CORE-054", "DDB-ATK-CORE-061"];
  for (const catalogId of ids) {
    const plan = effectPlanForCard(card(catalogId), registry);
    assert.equal(plan.source, "structured", catalogId + " should prefer structured behavior");
    assert.deepEqual(plan.unsupported, [], catalogId + " should have no queued clauses");
    assert.ok(plan.dedicated.includes("attack.grantNextAttackFlow"), catalogId + " should use the structured Flow resolver");
  }

  const backKick = card("DDB-ATK-CORE-005");
  assert.equal(conditionalAttackPowerBonus(backKick, powerContext({ firstAttack: true })).amount, 2);
  assert.equal(conditionalAttackPowerBonus(backKick, powerContext({ firstAttack: false })).amount, 0);
  assert.deepEqual(structuredNextAttackFlow(backKick, nextFlowContext()), { handled: true, grant: true });

  const snapFrontKick = card("DDB-ATK-CORE-053");
  assert.deepEqual(structuredNextAttackFlow(snapFrontKick, nextFlowContext({ timing: "onHit" })), { handled: true, grant: true });

  const spinningBackfist = card("DDB-ATK-CORE-054");
  assert.deepEqual(structuredNextAttackFlow(spinningBackfist, nextFlowContext({ differentZoneFromPreviousAttack: false })), { handled: true, grant: false });
  assert.deepEqual(structuredNextAttackFlow(spinningBackfist, nextFlowContext({ differentZoneFromPreviousAttack: true })), { handled: true, grant: true });

  const blitz = card("DDB-ATK-CORE-061");
  assert.deepEqual(structuredNextAttackFlow(blitz, nextFlowContext()), { handled: true, grant: true });
});


test("state-backed Attack batch is structured and executable", () => {
  const ids = ["DDB-ATK-CORE-036", "DDB-ATK-CORE-048", "DDB-ATK-CORE-069"];
  for (const catalogId of ids) {
    const plan = effectPlanForCard(card(catalogId), registry);
    assert.equal(plan.source, "structured", catalogId + " should prefer structured behavior");
    assert.deepEqual(plan.unsupported, [], catalogId + " should have no queued clauses");
  }

  const loadingDock = card("DDB-ATK-CORE-036");
  assert.deepEqual(structuredCurrentAttackFlow(loadingDock, { hasWeaponEquipped: false }), { handled: true, hasFlow: false });
  assert.deepEqual(structuredCurrentAttackFlow(loadingDock, { hasWeaponEquipped: true }), { handled: true, hasFlow: true });

  const refundable = card("DDB-ATK-CORE-048");
  assert.equal(conditionalAttackPowerBonus(refundable, powerContext({ playedAsReversal: true })).amount, 2);
  assert.equal(conditionalAttackPowerBonus(refundable, powerContext({ playedAsReversal: false })).amount, 0);
  assert.equal(targetNextAttackPenalty(refundable), 1);

  const uppercut = card("DDB-ATK-CORE-069");
  assert.equal(conditionalAttackPowerBonus(uppercut, powerContext({ targetTempoUsed: true })).amount, 2);
  assert.equal(conditionalAttackPowerBonus(uppercut, powerContext({ targetTempoUsed: false })).amount, 0);
});


test("first-Hit Focus and next-Any-zone Attack effects are structured", () => {
  const receipt = card("DDB-ATK-CORE-047");
  const receiptPlan = effectPlanForCard(receipt, registry);
  assert.equal(receiptPlan.source, "structured");
  assert.deepEqual(receiptPlan.unsupported, []);
  assert.deepEqual(structuredConditionalFocus(receipt, { timing: "onHit", attackNumber: 1 }), { handled: true, amount: 1 });
  assert.deepEqual(structuredConditionalFocus(receipt, { timing: "onHit", attackNumber: 2 }), { handled: true, amount: 0 });
  assert.deepEqual(structuredConditionalFocus(receipt, { timing: "afterResolve", attackNumber: 1 }), { handled: true, amount: 0 });

  const swan = card("DDB-ATK-CORE-058");
  const swanPlan = effectPlanForCard(swan, registry);
  assert.equal(swanPlan.source, "structured");
  assert.deepEqual(swanPlan.unsupported, []);
  assert.equal(attackCanChooseAnyZone(swan, false, []), false, "Swan Kick itself must not become Any-zone from its next-Attack text");
  assert.deepEqual(structuredNextAttackAnyZone(swan, { timing: "onHit", attackNumber: 1 }), { handled: true, grant: true });
  assert.deepEqual(structuredNextAttackAnyZone(swan, { timing: "afterResolve", attackNumber: 1 }), { handled: true, grant: false });
  assert.deepEqual(structuredNextAttackAnyZone(swan, { timing: "onHit", attackNumber: 0 }), { handled: true, grant: false });
});
