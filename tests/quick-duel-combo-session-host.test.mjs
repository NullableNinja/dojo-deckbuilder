import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { comboPlanForHost } from "../app/combo-playtest-bridge.ts";
import {
  activateQuickDuelComboOnBoards,
  publishQuickDuelComboTriggerOnBoards,
  resolveQuickDuelComboChoiceOnBoards,
} from "../app/quick-duel-combo-session-host.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const source = await readFile(new URL("../app/quick-duel-combo-session-host.ts", import.meta.url), "utf8");
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const combo = (catalogId) => byCatalogId.get(catalogId);
const attack = (id, tags = [], zone = "Mid") => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const defense = (id, tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Defense", tags });
const weapon = (id, tags = []) => ({ id, name: id, cardType: "Item", subtype: "Weapon", tags: ["Weapon", ...tags] });

function context(currentCard, overrides = {}) {
  return {
    priorCards: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
    hitZonesThisTurn: [],
    zonesPlayed: [],
    roundZonesPlayed: [],
    roundAttackHits: 0,
    equipment: [],
    startingHand: [],
    currentCard,
    currentZone: currentCard.zone ?? "Mid",
    currentAttackHit: false,
    currentDefense: null,
    currentDefenseBlocked: false,
    completedBeltExamThisRound: false,
    triggeredComboIds: [],
    previousAttackBlocked: false,
    blockFacts: [],
    speedGainWindows: [],
    purchaseFacts: [],
    playedCardFacts: [],
    attackFacts: [],
    ...overrides,
  };
}

function board(overrides = {}) {
  return {
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

test("Combo session projects immediate and later-trigger effects onto Quick Duel boards", () => {
  const first = attack("first", [], "High");
  const current = attack("current", [], "Low");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-016"), context(current, {
    priorCards: [first],
    attacksThisTurn: 1,
    zonesPlayed: ["High"],
    equipment: [weapon("flex", ["Flexible"])],
    currentZone: "Low",
  }), "onAttackDeclared");

  const activated = activateQuickDuelComboOnBoards({ self: board(), opponent: board() }, plan, "onAttackDeclared", "player", operations);
  assert.equal(activated.boards.self.nextAttackBonus, 2);
  assert.equal(activated.boards.opponent.tempSpeed, 0);

  const hit = publishQuickDuelComboTriggerOnBoards(activated.boards, activated.execution, "onHit", "player", operations);
  assert.equal(hit.boards.opponent.tempSpeed, -1);
  assert.ok(hit.boards.opponent.stage3cStatuses.some((status) => status.sourceEffectId === "combo-flexible-schedule-speed"));
});

test("Combo session installs deferred canonical statuses at requirement completion", () => {
  const current = attack("mid", [], "Mid");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-013"), context(current, {
    currentZone: "Mid",
    currentAttackHit: true,
    playedCardFacts: [{ window: "sinceLastTurn", card: defense("guard", ["Guard"]) }],
  }), "onHit");

  const activated = activateQuickDuelComboOnBoards({ self: board(), opponent: board() }, plan, "onHit", "player", operations);
  assert.equal(activated.boards.opponent.stage3cStatuses.length, 2);
  assert.ok(activated.boards.opponent.stage3cStatuses.every((status) => status.qualifier?.nextReaction));
});

test("structured Combo choice is surfaced, validated, moved, and followed up without identity dispatch", () => {
  const current = attack("swing", [], "Mid");
  const equipped = weapon("improvised-equipped", ["Improvised"]);
  const handWeapon = weapon("weapon-in-hand");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-022"), context(current, { equipment: [equipped] }), "onAttackDeclared");

  const activated = activateQuickDuelComboOnBoards({ self: board({ hand: [handWeapon.id] }), opponent: board() }, plan, "onAttackDeclared", "player", operations);
  assert.equal(activated.boards.self.stage3cChoices.length, 1);
  assert.equal(activated.boards.self.nextAttackBonus, 0, "follow-up power waits for required discard choice");

  const resolved = resolveQuickDuelComboChoiceOnBoards(activated.boards, activated.execution, combo("DDB-CMB-CORE-022"), handWeapon, "player", operations);
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.discardedCardId, handWeapon.id);
  assert.deepEqual(resolved.boards.self.hand, []);
  assert.deepEqual(resolved.boards.self.discard, [handWeapon.id]);
  assert.equal(resolved.boards.self.stage3cChoices.length, 0);
  assert.equal(resolved.boards.self.nextAttackBonus, 4);
});

test("Combo session host is generic and contains no Combo identity/prose rules", () => {
  assert.doesNotMatch(source, /DDB-CMB-CORE-|rulesText|Requirement:|Payoff:|combo\.name\s*===|catalogId\s*===/);
  assert.match(source, /applyQuickDuelRuntimeCommands/);
  assert.match(source, /activateQuickDuelComboPlan/);
});
