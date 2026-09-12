import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  emptyComboHostFacts,
  recordComboHostAttack,
  recordComboHostCardPlayed,
  recordComboHostPurchase,
} from "../app/combo-host-facts.ts";
import { withComboHostFacts } from "../app/quick-duel-transition-host.ts";
import { comboContextFromQuickDuelBoard, quickDuelComboPlansForEvent } from "../app/quick-duel-combo-planner.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const source = await readFile(new URL("../app/quick-duel-combo-planner.ts", import.meta.url), "utf8");
const byId = new Map(cards.map((card) => [card.id, card]));
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const lookup = (id) => byId.get(id) ?? byCatalogId.get(id) ?? null;
const combo = (catalogId) => byCatalogId.get(catalogId);

function fakeCard(id, subtype, tags = [], zone = null) {
  return { id, name: id, catalogId: id, cardType: subtype === "Consumable" ? "Item" : "Technique", subtype, tags, zone };
}

const fake = new Map();
function put(card) { fake.set(card.id, card); return card; }
const lookupWithFake = (id) => fake.get(id) ?? lookup(id);

function board(overrides = {}) {
  return {
    hand: [],
    discard: [],
    cardsThisTurn: [],
    zonesPlayed: [],
    equipment: [],
    tempSpeed: 0,
    cardsBought: 0,
    currentAttackIsReversal: false,
    characterMarks: {},
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
    completedBeltExamThisRound: false,
    learnedCombos: [],
    triggeredCombos: [],
    ...overrides,
  };
}

test("planner derives purchase-history Combo eligibility from structured host facts", () => {
  fake.clear();
  const purchasedWeapon = put(fakeCard("weapon-purchased", "Weapon", ["Weapon"]));
  const current = put(fakeCard("weapon-attack", "Attack", ["Attack", "Weapon"], "Mid"));
  let facts = emptyComboHostFacts();
  facts = recordComboHostPurchase(facts, purchasedWeapon.id);
  const state = withComboHostFacts(board({ learnedCombos: [combo("DDB-CMB-CORE-036").id] }), facts);

  const plans = quickDuelComboPlansForEvent(state, current, "Mid", lookupWithFake, "onHit", { currentAttackHit: true });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].combo.catalogId, "DDB-CMB-CORE-036");
  assert.ok((plans[0].plan.commandsByTrigger.onHit ?? []).some((command) => command.effect === "core.draw"));
});

test("planner handles a Combo completed by a Consumable already committed to card history", () => {
  fake.clear();
  const one = put(fakeCard("attack-one", "Attack", ["Attack"], "High"));
  const two = put(fakeCard("attack-two", "Attack", ["Attack"], "Mid"));
  const drink = put(fakeCard("drink", "Consumable", ["Consumable"]));
  let facts = emptyComboHostFacts();
  facts = recordComboHostCardPlayed(facts, one.id, "High");
  facts = recordComboHostCardPlayed(facts, two.id, "Mid");
  facts = recordComboHostCardPlayed(facts, drink.id);
  facts = recordComboHostAttack(facts, one.id, "High", { hit: true });
  facts = recordComboHostAttack(facts, two.id, "Mid", { hit: false });
  const state = withComboHostFacts(board({
    cardsThisTurn: [one.id, two.id, drink.id],
    zonesPlayed: ["High", "Mid"],
    learnedCombos: [combo("DDB-CMB-CORE-049").id],
  }), facts);

  const context = comboContextFromQuickDuelBoard(state, drink, "", lookupWithFake);
  assert.deepEqual(context.priorCards.map((card) => card.id), [one.id, two.id], "current Consumable must not be duplicated as prior history");

  const plans = quickDuelComboPlansForEvent(state, drink, "", lookupWithFake, "onPlay");
  assert.equal(plans.length, 1);
  assert.equal(plans[0].combo.catalogId, "DDB-CMB-CORE-049");
  assert.deepEqual((plans[0].plan.commandsByTrigger.afterResolve ?? []).map((command) => command.effect).sort(), ["core.discard", "core.draw"]);
});

test("planner uses round played-card facts for a Defense-completing Combo", () => {
  fake.clear();
  const guardOne = put(fakeCard("guard-one", "Defense", ["Defense", "Guard"]));
  const guardTwo = put(fakeCard("guard-two", "Defense", ["Defense", "Guard"]));
  let facts = emptyComboHostFacts();
  facts = recordComboHostCardPlayed(facts, guardOne.id);
  facts = recordComboHostCardPlayed(facts, guardTwo.id);
  const state = withComboHostFacts(board({
    cardsThisTurn: [guardOne.id, guardTwo.id],
    defendedThisRound: true,
    learnedCombos: [combo("DDB-CMB-CORE-041").id],
  }), facts);

  const plans = quickDuelComboPlansForEvent(state, guardTwo, "Mid", lookupWithFake, "onBlock", {
    currentDefense: guardTwo,
    currentDefenseBlocked: true,
  });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].combo.catalogId, "DDB-CMB-CORE-041");
  assert.ok((plans[0].plan.deferredOnCompletion ?? []).length > 0 || Object.values(plans[0].plan.commandsByTrigger).flat().length > 0);
});

test("planner ignores stale board attack counters and derives prior sequence from card/fact history", () => {
  fake.clear();
  const prior = put(fakeCard("prior-attack", "Attack", ["Attack", "Multi-Hit"], "Mid"));
  const current = put(fakeCard("current-attack", "Attack", ["Attack"], "High"));
  let facts = emptyComboHostFacts();
  facts = recordComboHostCardPlayed(facts, prior.id, "Mid");
  const state = withComboHostFacts(board({
    cardsThisTurn: [prior.id],
    zonesPlayed: ["Mid"],
    attacksThisTurn: 99,
    learnedCombos: [combo("DDB-CMB-CORE-004").id],
  }), facts);

  const context = comboContextFromQuickDuelBoard(state, current, "High", lookupWithFake);
  assert.equal(context.attacksThisTurn, 1);
  const plans = quickDuelComboPlansForEvent(state, current, "High", lookupWithFake, "onAttackDeclared");
  assert.equal(plans.length, 1);
  assert.equal(plans[0].combo.catalogId, "DDB-CMB-CORE-004");
});

test("Combo planning adapter contains no Combo identity dispatch or printed prose parsing", () => {
  assert.doesNotMatch(source, /DDB-CMB-CORE-|rulesText|Requirement:|Payoff:|combo\.name\s*===|catalogId\s*===/);
  assert.match(source, /comboHostFactsFromBoard/);
  assert.match(source, /comboPlanForHost/);
});
