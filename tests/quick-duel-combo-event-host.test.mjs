import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hostQuickDuelComboEvent,
  prepareQuickDuelComboAttack,
} from "../app/quick-duel-combo-event-host.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const attack = (id, zone = "Mid", tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const defense = (id, zone = "Any", tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Defense", tags, zone });
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

test("pre-Attack host activates canonical Combo commands and exposes generic Piercing facts", () => {
  const combo = byCatalogId.get("DDB-CMB-CORE-024");
  const kata = { id: "kata", name: "kata", cardType: "Technique", subtype: "Kata", tags: [] };
  const current = attack("current", "Mid");
  const lookup = lookupWith(kata, current);
  const self = board({
    learnedCombos: [combo.id],
    cardsThisTurn: [kata.id],
  });

  const prepared = prepareQuickDuelComboAttack({ self, opponent: board() }, current, "Mid", lookup, "player", operations);
  assert.deepEqual(prepared.activatedComboIds, [combo.id]);
  assert.equal(prepared.attackFacts.piercing, 2);
  assert.ok(prepared.boards.self.triggeredCombos.includes(combo.id));
});

test("composed event host preserves an active session across Attack declaration and later Hit", () => {
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

  const declared = prepareQuickDuelComboAttack({ self, opponent: board() }, current, "Low", lookup, "player", operations);
  assert.equal(declared.boards.self.nextAttackBonus, 2);

  const hit = hostQuickDuelComboEvent(declared.boards, current, "Low", lookup, "onHit", "player", operations, { currentAttackHit: true });
  assert.equal(hit.boards.opponent.tempSpeed, -1);
  assert.ok(hit.boards.opponent.stage3cStatuses.some((status) => status.sourceEffectId === "combo-flexible-schedule-speed"));
});

test("Defense Block can complete a learned Combo without Attack-only evaluation", () => {
  const combo = byCatalogId.get("DDB-CMB-CORE-017");
  const guard = defense("guard", "Any", ["Guard"]);
  const lookup = lookupWith(guard);
  const self = board({
    learnedCombos: [combo.id],
    cardsThisTurn: [guard.id],
    defendedThisRound: true,
    blockedThisRound: true,
  });

  const blocked = hostQuickDuelComboEvent(
    { self, opponent: board() },
    guard,
    "Mid",
    lookup,
    "onBlock",
    "player",
    operations,
    { currentDefense: guard, currentDefenseBlocked: true },
  );
  assert.deepEqual(blocked.activatedComboIds, [combo.id]);
  assert.ok(blocked.boards.self.triggeredCombos.includes(combo.id));

  const initiate = hostQuickDuelComboEvent(blocked.boards, guard, "Mid", lookup, "onInitiate", "player", operations);
  assert.equal(initiate.boards.self.drawn, 1);
});

test("composed event host remains identity-free and never parses Combo prose", async () => {
  const source = await readFile(new URL("../app/quick-duel-combo-event-host.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /DDB-CMB-CORE-|rulesText|displayText|combo\.name\s*===|catalogId\s*===/);
  assert.match(source, /publishQuickDuelComboSessions/);
  assert.match(source, /activateQuickDuelCombosForEvent/);
});
