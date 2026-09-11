import assert from "node:assert/strict";
import test from "node:test";
import { comboHostFactsFromBoard, applyQuickDuelStructuredTransition } from "../app/quick-duel-transition-host.ts";

const cards = new Map([
  ["atk-high", { id: "atk-high", name: "High Attack", cardType: "Technique", subtype: "Attack", tags: ["Attack"], zone: "High" }],
  ["def-dodge", { id: "def-dodge", name: "Dodge", cardType: "Technique", subtype: "Defense", tags: ["Defense", "Dodge"] }],
  ["kata", { id: "kata", name: "Kata", cardType: "Technique", subtype: "Kata", tags: ["Kata"] }],
  ["weapon", { id: "weapon", name: "Weapon", cardType: "Item", subtype: "Weapon", tags: ["Weapon", "Blade"] }],
  ["refill", { id: "refill", name: "Refill", cardType: "Technique", subtype: "Attack", tags: ["Attack"] }],
]);
const lookup = (id) => cards.get(id);

function board(overrides = {}) {
  return {
    hand: ["atk-high", "def-dodge", "kata"],
    discard: [],
    cardsThisTurn: [],
    zonesPlayed: [],
    equipment: [],
    tempSpeed: 0,
    cardsBought: 0,
    currentAttackIsReversal: false,
    characterMarks: {},
    ...overrides,
  };
}

function match(overrides = {}) {
  return {
    player: board(),
    ai: board(),
    market: ["weapon", "refill"],
    round: 1,
    phase: "player-initiate",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    locationId: "loc",
    ...overrides,
  };
}

test("transition adapter derives played-card, combat, block, and speed facts", () => {
  const previous = match();
  const next = match({
    player: board({ cardsThisTurn: ["kata", "atk-high"], zonesPlayed: ["High"], tempSpeed: 1 }),
    ai: board({ discard: ["def-dodge"] }),
    phase: "player-yell",
    lastExchange: { id: "x1", actor: "player", target: "ai", attackCardId: "atk-high", defenseCardId: "def-dodge", zone: "High", outcome: "block" },
  });
  const derived = applyQuickDuelStructuredTransition(previous, next, lookup);
  const playerFacts = comboHostFactsFromBoard(derived.player);
  const aiFacts = comboHostFactsFromBoard(derived.ai);
  assert.deepEqual(playerFacts.startingHandIds, previous.player.hand);
  assert.ok(playerFacts.turnPlayed.some((fact) => fact.cardId === "kata"));
  assert.ok(playerFacts.turnPlayed.some((fact) => fact.cardId === "atk-high" && fact.zone === "High"));
  assert.ok(playerFacts.turnAttacks.some((fact) => fact.cardId === "atk-high" && fact.blocked));
  assert.equal(playerFacts.speedGainedSinceLastTurn, true);
  assert.ok(aiFacts.sinceLastTurnBlocks.some((fact) => fact.defenseCardId === "def-dodge" && fact.incomingZone === "High"));
});

test("transition adapter records Market purchases from discard/Market diff", () => {
  const previous = match({ phase: "player-ascend" });
  const next = match({
    phase: "player-ascend",
    market: ["refill"],
    player: board({ discard: ["weapon"], cardsBought: 1 }),
  });
  const derived = applyQuickDuelStructuredTransition(previous, next, lookup);
  assert.deepEqual(comboHostFactsFromBoard(derived.player).purchasesSinceLastAscend, [{ cardId: "weapon" }]);
});

test("turn handoff closes old since-last-turn window and captures next fighter starting hand", () => {
  const previous = match({
    player: board({ cardsThisTurn: ["kata"] }),
    ai: board({ hand: ["def-dodge", "atk-high"] }),
  });
  const next = match({
    player: board({ cardsThisTurn: [], hand: ["atk-high"] }),
    ai: board({ hand: ["def-dodge", "atk-high"] }),
    phase: "ai-ready",
    turnIndex: 1,
  });
  const derived = applyQuickDuelStructuredTransition(previous, next, lookup);
  const playerFacts = comboHostFactsFromBoard(derived.player);
  const aiFacts = comboHostFactsFromBoard(derived.ai);
  assert.deepEqual(playerFacts.sinceLastTurnPlayed, []);
  assert.deepEqual(aiFacts.startingHandIds, ["def-dodge", "atk-high"]);
});

test("round advance clears round history and begins the new initiative fighter turn", () => {
  const previous = match({
    phase: "ai-ready",
    turnOrder: ["player", "ai"],
    turnIndex: 1,
    player: board({ cardsThisTurn: ["kata"] }),
    ai: board({ cardsThisTurn: ["atk-high"], zonesPlayed: ["High"] }),
  });
  const next = match({
    round: 2,
    phase: "player-initiate",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    player: board({ hand: ["kata", "atk-high"] }),
    ai: board({ hand: ["def-dodge"] }),
  });
  const derived = applyQuickDuelStructuredTransition(previous, next, lookup);
  assert.deepEqual(comboHostFactsFromBoard(derived.player).roundPlayed, []);
  assert.deepEqual(comboHostFactsFromBoard(derived.ai).roundPlayed, []);
  assert.deepEqual(comboHostFactsFromBoard(derived.player).startingHandIds, ["kata", "atk-high"]);
});
