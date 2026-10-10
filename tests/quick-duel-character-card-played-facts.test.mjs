import assert from "node:assert/strict";
import test from "node:test";

import { applyQuickDuelPlaytestTransition } from "../app/quick-duel-playtest-host.ts";
import {
  structuredCardHasNoPrintedNumericEffect,
  structuredCardHasPrintedNumericEffect,
} from "../app/structured-card-facts.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-016",
    belt: 3,
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: ["h1", "h2"],
    deck: ["d1", "d2"],
    discard: [],
    destroyed: [],
    learnedCombos: [],
    triggeredCombos: [],
    cardsBought: 0,
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    damageDealt: 0,
    damageTaken: 0,
    completedBeltExamThisRound: false,
    ...overrides,
  };
}

function match(player = board(), ai = board({ fighterId: "DDB-CHR-CORE-001" })) {
  return {
    schema: 8,
    player,
    ai,
    market: [],
    round: 1,
    phase: "player-yell",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    pendingChoice: null,
    winner: null,
    log: [],
  };
}

const airHorn = {
  id: "air-horn-test",
  catalogId: "DDB-CON-CORE-001",
  name: "Air Horn",
  cardType: "Item",
  subtype: "Consumable",
  tags: ["Reaction", "Consumable"],
  zone: null,
};
const accordionGuard = {
  id: "accordion-guard-test",
  catalogId: "DDB-DEF-CORE-001",
  name: "Accordion-Folder Guard",
  cardType: "Technique",
  subtype: "Defense",
  tags: ["Defense", "Guard", "Draw", "Discard"],
  zone: "High, Mid",
};

const lookup = (id) => id === airHorn.id ? airHorn : id === accordionGuard.id ? accordionGuard : null;

test("structured numeric-effect fact is derived from canonical effect data, not rules prose", () => {
  assert.equal(structuredCardHasPrintedNumericEffect(airHorn), false);
  assert.equal(structuredCardHasNoPrintedNumericEffect(airHorn), true);
  assert.equal(structuredCardHasPrintedNumericEffect(accordionGuard), true);
  assert.equal(structuredCardHasNoPrintedNumericEffect(accordionGuard), false);
  assert.equal(structuredCardHasNoPrintedNumericEffect({ catalogId: "DDB-UNKNOWN-999" }), null);
});

test("Ink Fist receives noPrintedNumericEffect from a structured no-number cardPlayed transition", () => {
  const previous = match();
  const next = {
    ...previous,
    player: { ...previous.player, cardsThisTurn: [airHorn.id] },
  };
  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookup);
  assert.equal(hosted.player.nextAttackBonus, 1);
  assert.ok(hosted.player.characterMarks["turn:noNumericAttack"]);
});

test("Ink Fist does not trigger for a structured card with numeric mechanics or an unknown card", () => {
  const numericPrevious = match();
  const numericNext = {
    ...numericPrevious,
    player: { ...numericPrevious.player, cardsThisTurn: [accordionGuard.id] },
  };
  const numericHosted = applyQuickDuelPlaytestTransition(numericPrevious, numericNext, lookup);
  assert.equal(numericHosted.player.nextAttackBonus, 0);

  const unknown = { id: "unknown-card", catalogId: "DDB-UNKNOWN-999", name: "Unknown", cardType: "Technique", subtype: "Kata", tags: [], zone: null };
  const unknownLookup = (id) => id === unknown.id ? unknown : null;
  const unknownPrevious = match();
  const unknownNext = {
    ...unknownPrevious,
    player: { ...unknownPrevious.player, cardsThisTurn: [unknown.id] },
  };
  const unknownHosted = applyQuickDuelPlaytestTransition(unknownPrevious, unknownNext, unknownLookup);
  assert.equal(unknownHosted.player.nextAttackBonus, 0, "missing structured data must not guess from printed prose");
});
