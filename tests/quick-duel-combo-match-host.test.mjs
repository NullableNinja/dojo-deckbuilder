import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  activateQuickDuelCombosForEvent,
  publishQuickDuelComboSessions,
  quickDuelActiveComboExecutions,
} from "../app/quick-duel-combo-match-host.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const attack = (id, zone = "Mid", tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const consumable = (id) => ({ id, name: id, cardType: "Item", subtype: "Consumable", tags: ["Consumable"] });
const weapon = (id, tags = []) => ({ id, name: id, cardType: "Item", subtype: "Weapon", tags: ["Weapon", ...tags] });

function board(overrides = {}) {
  return {
    fighterId: "fighter",
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    focusGeneratedThisTurn: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    damageTaken: 0,
    speedChangedThisRound: false,
    hand: [],
    discard: [],
    equipment: [],
    cardsThisTurn: [],
    zonesPlayed: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
    learnedCombos: [],
    triggeredCombos: [],
    comboTriggered: false,
    characterMarks: {},
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    stage3cDefenseModifier: 0,
    stage3cAttackModifier: 0,
    stage3cSpeedOverride: null,
    stage3cPurchaseCostModifier: 0,
    drawn: 0,
    ...overrides,
  };
}

const operations = {
  draw: (state, amount) => ({ ...state, drawn: state.drawn + Math.max(0, amount) }),
  discardForAi: (state, amount) => {
    const hand = [...state.hand];
    const discarded = hand.splice(0, Math.min(hand.length, Math.max(0, amount)));
    return { ...state, hand, discard: [...state.discard, ...discarded] };
  },
};

function lookupWith(...extra) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  for (const card of extra) byId.set(card.id, card);
  return (id) => byId.get(id) ?? null;
}

test("match host persists a Combo execution across declaration and later Hit trigger", () => {
  const combo = byCatalogId.get("DDB-CMB-CORE-016");
  const first = attack("first", "High");
  const current = attack("current", "Low");
  const flexible = weapon("flexible", ["Flexible"]);
  const lookup = lookupWith(first, current, flexible);
  const self = board({
    learnedCombos: [combo.id],
    cardsThisTurn: [first.id],
    zonesPlayed: ["High"],
    attacksThisTurn: 1,
    equipment: [flexible.id],
  });

  const activated = activateQuickDuelCombosForEvent({ self, opponent: board() }, current, "Low", lookup, "onAttackDeclared", "player", operations);
  assert.deepEqual(activated.activatedComboIds, [combo.id]);
  assert.equal(activated.boards.self.nextAttackBonus, 2);
  assert.equal(activated.boards.self.comboTriggered, true);
  assert.ok(activated.boards.self.triggeredCombos.includes(combo.id));
  assert.ok(quickDuelActiveComboExecutions(activated.boards.self)[combo.id]?.active);

  const hit = publishQuickDuelComboSessions(activated.boards, "onHit", "player", operations);
  assert.equal(hit.boards.opponent.tempSpeed, -1);
  assert.ok(hit.boards.opponent.stage3cStatuses.some((status) => status.sourceEffectId === "combo-flexible-schedule-speed"));
});

test("match host activates a non-Attack Combo completion from normal card history", () => {
  const combo = byCatalogId.get("DDB-CMB-CORE-049");
  const first = attack("first", "High");
  const second = attack("second", "Low");
  const drink = consumable("drink");
  const lookup = lookupWith(first, second, drink);
  const self = board({
    learnedCombos: [combo.id],
    cardsThisTurn: [first.id, second.id, drink.id],
    zonesPlayed: ["High", "Low"],
    attacksThisTurn: 2,
  });

  const activated = activateQuickDuelCombosForEvent({ self, opponent: board() }, drink, "", lookup, "onPlay", "player", operations);
  assert.deepEqual(activated.activatedComboIds, [combo.id]);
  assert.ok(activated.boards.self.triggeredCombos.includes(combo.id));
  assert.equal(activated.boards.self.comboTriggered, true);
});

test("match host source remains identity-free and stores sessions only under the structured host mark", async () => {
  const source = await readFile(new URL("../app/quick-duel-combo-match-host.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /DDB-CMB-CORE-|rulesText|Requirement:|Payoff:|combo\.name\s*===|catalogId\s*===/);
  assert.match(source, /structuredHost\.comboExecutions/);
  assert.match(source, /quickDuelComboPlansForEvent/);
  assert.match(source, /publishQuickDuelComboTriggerOnBoards/);
});
