import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQuickDuelPlaytestTransition,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

const normalCard = { id: "normal-card", name: "Normal Card", cardType: "Technique", subtype: "Kata", tags: [], zone: null };
const junkCard = { id: "junk-card", name: "Canonical Junk", cardType: "Junk", subtype: "Junk", tags: ["Junk"], zone: null };
const marketCard = { id: "market-card", name: "Market Card", cardType: "Technique", subtype: "Kata", tags: [], zone: null };

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-001",
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
    hand: [],
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

function match(player = board(), ai = board(), overrides = {}) {
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
    ...overrides,
  };
}

const lookupWith = (...cards) => {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return (id) => byId.get(id) ?? null;
};

test("Boo-Fu sees a new discard outside Hide exactly once", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-004", hand: [normalCard.id] }));
  const next = {
    ...previous,
    player: { ...previous.player, hand: [], discard: [normalCard.id] },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(normalCard));
  assert.equal(hosted.player.nextAttackBonus, 1);

  const repeated = applyQuickDuelPlaytestTransition(hosted, { ...hosted }, lookupWith(normalCard));
  assert.equal(repeated.player.nextAttackBonus, 1, "unchanged discard must not republish discarded");
});

test("Hide cleanup does not publish discarded Character events", () => {
  const previous = match(
    board({ fighterId: "DDB-CHR-CORE-004", hand: [normalCard.id], cardsThisTurn: ["played"] }),
    board(),
    { phase: "player-ascend", turnIndex: 0 },
  );
  const next = {
    ...previous,
    phase: "ai-ready",
    turnIndex: 1,
    player: {
      ...previous.player,
      hand: [],
      discard: [normalCard.id],
      cardsThisTurn: [],
    },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(normalCard));
  assert.equal(hosted.player.nextAttackBonus, 0);
});

test("Market acquisition into discard is not misclassified as a discard action", () => {
  const previous = match(
    board({ fighterId: "DDB-CHR-CORE-004", cardsBought: 0 }),
    board(),
    { market: [marketCard.id] },
  );
  const next = {
    ...previous,
    market: [],
    player: {
      ...previous.player,
      cardsBought: 1,
      discard: [marketCard.id],
    },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(marketCard));
  assert.equal(hosted.player.nextAttackBonus, 0);
});

test("Custodian Kwon receives the discarded Junk identity and resolves destroy through the generic Character choice", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-008", hand: [junkCard.id] }));
  const next = {
    ...previous,
    player: { ...previous.player, hand: [], discard: [junkCard.id] },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(junkCard));
  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.choice?.resolver, "character.forcedJunkDiscardDestroyChoice");
  assert.equal(hosted.pendingChoice?.event?.selectedId, junkCard.id);
  assert.equal(hosted.pendingChoice?.event?.discardedJunk, true);

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    hosted,
    "player",
    hosted.pendingChoice.event,
    hosted.pendingChoice.choice,
    "accept",
  );
  assert.ok(!resolved.match.player.discard.includes(junkCard.id));
  assert.ok(resolved.match.player.destroyed.includes(junkCard.id));
});

test("AI Honorable Trash Panda auto-resolves Junk destruction without a React choice", () => {
  const previous = match(
    board(),
    board({ fighterId: "DDB-CHR-CORE-015", hand: [junkCard.id], deck: ["d1", "d2"] }),
    { turnOrder: ["ai", "player"] },
  );
  const next = {
    ...previous,
    ai: { ...previous.ai, hand: [], discard: [junkCard.id] },
  };

  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(junkCard));
  assert.ok(hosted.ai.destroyed.includes(junkCard.id));
  assert.equal(hosted.pendingChoice, null);
});
