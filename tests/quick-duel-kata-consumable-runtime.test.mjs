import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  conditionalHealAfterHit,
  deckLookPlan,
  destroyJunkChoicePlan,
  discardChoiceFollowup,
  mandatoryDiscardChoiceCount,
  structuredFocusIfFastest,
  structuredNextAttackAnyZone,
  structuredNextAttackFlow,
} from "../app/effect-resolvers.ts";
import {
  consumableRuntimeCommands,
  structuredConsumableDestroysAfterUse,
  structuredConsumableMandatoryDiscard,
  structuredConsumableReturnsToSupply,
} from "../app/consumable-effect-resolvers.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));

function card(catalogId) {
  const found = byCatalog.get(catalogId);
  assert.ok(found, `missing canonical card ${catalogId}`);
  return found;
}

test("Morning-Shift Meditation uses structured discard choice and zero-Focus followup", () => {
  const kata = card("DDB-KAT-CORE-039");
  assert.equal(mandatoryDiscardChoiceCount(kata), 1);
  assert.equal(discardChoiceFollowup(kata, { cardType: "Starter", focusValue: 0 }).focus, 1);
  assert.equal(discardChoiceFollowup(kata, { cardType: "Starter", focusValue: 1 }).focus, 0);
});

test("After-Action Huddle branches from the card actually discarded", () => {
  const kata = card("DDB-KAT-CORE-002");
  assert.equal(mandatoryDiscardChoiceCount(kata), 1);
  assert.equal(discardChoiceFollowup(kata, { cardType: "Technique", focusValue: 1 }).nextAttackPower, 1);
  assert.equal(discardChoiceFollowup(kata, { cardType: "Item", focusValue: 1 }).nextDefenseGuard, 1);
  assert.deepEqual(discardChoiceFollowup(kata, { cardType: "Character", focusValue: 1 }), {
    focus: 0,
    nextAttackPower: 0,
    nextDefenseGuard: 0,
    notes: [],
  });
});

test("structured Kata Junk destruction reaches the existing Quick Duel choice surface", () => {
  assert.deepEqual(destroyJunkChoicePlan(card("DDB-KAT-CORE-010")), {
    resolver: "kata.destroyChoice",
    count: 1,
    sources: ["hand", "discard"],
    optional: false,
    drawAfterSuccess: 1,
  });
  assert.deepEqual(destroyJunkChoicePlan(card("DDB-KAT-CORE-031")), {
    resolver: "kata.destroyChoice",
    count: 1,
    sources: ["hand", "discard"],
    optional: false,
    drawAfterSuccess: 0,
  });
});

test("structured Kata deck-look plans reach generic Quick Duel deck choices", () => {
  assert.deepEqual(deckLookPlan(card("DDB-KAT-CORE-018")), {
    kind: "pick-discard",
    count: 3,
    filter: "defense-or-kata",
    optional: false,
    noMatchFocus: 1,
  });
  assert.deepEqual(deckLookPlan(card("DDB-KAT-CORE-029")), {
    kind: "pick-reorder",
    count: 3,
    filter: "technique",
    optional: false,
  });
  assert.deepEqual(deckLookPlan(card("DDB-KAT-CORE-030")), {
    kind: "pick-shuffle",
    count: 5,
    filter: "item",
    optional: true,
  });
});

test("Footwork Drill fastest reward does not accidentally resolve unrelated deferred Kata rewards", () => {
  assert.equal(structuredFocusIfFastest(card("DDB-KAT-CORE-021"), 6, 4), 1);
  assert.equal(structuredFocusIfFastest(card("DDB-KAT-CORE-021"), 4, 6), 0);
  assert.equal(structuredFocusIfFastest(card("DDB-KAT-CORE-001"), 6, 4), 0);
});

test("Breath Control and Heian Shodan reach generic next-Attack state", () => {
  assert.deepEqual(structuredNextAttackFlow(card("DDB-KAT-CORE-007"), { timing: "onPlay" }), { handled: true, grant: true });
  assert.deepEqual(structuredNextAttackAnyZone(card("DDB-KAT-CORE-026"), { timing: "onPlay", attackNumber: 0 }), { handled: true, grant: true });
});

test("Recovery Stance conditional healing is driven by canonical Kata facts", () => {
  assert.equal(conditionalHealAfterHit(card("DDB-KAT-CORE-047"), true), 3);
  assert.equal(conditionalHealAfterHit(card("DDB-KAT-CORE-047"), false), 0);
});

test("Consumable mandatory discard and lifecycle are executable rather than merely registered", () => {
  const greenTea = card("DDB-CON-CORE-025");
  assert.equal(structuredConsumableMandatoryDiscard(greenTea), 1);
  assert.equal(consumableRuntimeCommands(greenTea, "onPlay").some((command) => command.effect === "core.draw" && command.amount === 2), true);
  assert.equal(structuredConsumableReturnsToSupply(greenTea), true);
  assert.equal(structuredConsumableDestroysAfterUse(greenTea), false);

  const carbonated = card("DDB-CON-CORE-007");
  assert.equal(structuredConsumableDestroysAfterUse(carbonated), true);
  assert.equal(structuredConsumableReturnsToSupply(carbonated), false);
});

test("Quick Duel source invokes the certified Kata and Consumable surfaces", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /mandatoryDiscardChoiceCount\(card\)/);
  assert.match(source, /discardChoiceFollowup\(sourceCard, selected\)/);
  assert.match(source, /destroyJunkChoicePlan\(card\)/);
  assert.match(source, /deckLookPlan\(card\)/);
  assert.match(source, /structuredFocusIfFastest\(card,/);
  assert.match(source, /structuredConsumableMandatoryDiscard\(card,/);
  assert.match(source, /returnsToSupplyAfterUse\(card\)/);
  assert.match(source, /destroysAfterUse\(card\)/);
});
