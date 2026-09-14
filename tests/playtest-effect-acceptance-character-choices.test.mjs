import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQuickDuelPlaytestTransition,
  publishQuickDuelPlaytestLifecycleEvent,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

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
    deck: [],
    discard: [],
    destroyed: [],
    learnedCombos: [],
    triggeredCombos: [],
    cardsBought: 0,
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    nextInitiateFocus: 0,
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
    phase: "player-initiate",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    locationId: "location-a",
    pendingChoice: null,
    winner: null,
    log: [],
    ...overrides,
  };
}

const operations = {
  draw: (state, amount) => ({ ...state, drawn: (state.drawn ?? 0) + Math.max(0, amount) }),
};

const noCards = () => null;

test("Master Mimen uses the same Initiate choice contract for player and AI and suppresses repeat use in-round", () => {
  const playerStart = match(
    board({ fighterId: "DDB-CHR-CORE-024" }),
    board(),
  );
  const playerOffer = publishQuickDuelPlaytestLifecycleEvent(playerStart, "player", "onInitiate", operations, noCards);
  assert.equal(playerOffer.characterPublished, true);
  assert.equal(playerOffer.characterConflict, false);
  assert.equal(playerOffer.characterChoices.length, 1);
  assert.equal(playerOffer.characterChoices[0].resolver, "character.noWeaponOffenseDefenseChoice");
  assert.equal(playerOffer.characterChoices[0].selectionField, "selectedMode");
  assert.deepEqual(playerOffer.characterChoices[0].options, ["attack", "defense"]);

  const playerResolved = resolveQuickDuelPlaytestCharacterChoice(
    playerOffer.match,
    "player",
    playerOffer.characterEvent,
    playerOffer.characterChoices[0],
    "attack",
  );
  assert.equal(playerResolved.match.player.nextAttackBonus, 1);
  assert.equal(playerResolved.match.player.usedCharacterEffectIdsThisRound.length, 1);

  const playerRepeat = publishQuickDuelPlaytestLifecycleEvent(playerResolved.match, "player", "onInitiate", operations, noCards);
  assert.equal(playerRepeat.characterChoices.length, 0);
  assert.equal(playerRepeat.match.player.nextAttackBonus, 1, "same-round repeat Initiate must not stack Mimen");

  const aiStart = match(
    board(),
    board({ fighterId: "DDB-CHR-CORE-024" }),
    { phase: "ai-initiate", turnIndex: 1 },
  );
  const aiResolved = publishQuickDuelPlaytestLifecycleEvent(aiStart, "ai", "onInitiate", operations, noCards);
  assert.equal(aiResolved.characterPublished, true);
  assert.equal(aiResolved.characterChoices.length, 0, "AI resolves through the shared Character choice contract");
  assert.equal(aiResolved.match.ai.nextAttackBonus, 1);
  assert.equal(aiResolved.match.ai.usedCharacterEffectIdsThisRound.length, 1);

  const aiRepeat = publishQuickDuelPlaytestLifecycleEvent(aiResolved.match, "ai", "onInitiate", operations, noCards);
  assert.equal(aiRepeat.match.ai.nextAttackBonus, 1);
  assert.equal(aiRepeat.match.ai.usedCharacterEffectIdsThisRound.length, 1);
});

test("Venue Val cycles through the real Scene Change transition for player and AI and suppresses repeat use in-round", () => {
  const playerStart = match(
    board({ fighterId: "DDB-CHR-CORE-039", hand: ["player-h1"], deck: ["player-d1", "player-d2"] }),
    board(),
  );
  const playerHosted = applyQuickDuelPlaytestTransition(
    playerStart,
    { ...playerStart, locationId: "location-b" },
    noCards,
  );
  assert.equal(playerHosted.pendingChoice?.kind, "character-runtime");
  assert.equal(playerHosted.pendingChoice?.event?.type, "sceneChange");
  assert.equal(playerHosted.pendingChoice?.choice?.resolver, "character.sceneChangeCycle");
  assert.deepEqual(playerHosted.player.hand, ["player-h1", "player-d2"]);

  const playerResolved = resolveQuickDuelPlaytestCharacterChoice(
    playerHosted,
    "player",
    playerHosted.pendingChoice.event,
    playerHosted.pendingChoice.choice,
    "player-h1",
  );
  assert.deepEqual(playerResolved.match.player.hand, ["player-d2"]);
  assert.deepEqual(playerResolved.match.player.discard, ["player-h1"]);
  assert.deepEqual(
    playerResolved.match.player.usedCharacterEffectIdsThisRound,
    ["character-venue-draw", "character-venue-discard"],
    "one logical Scene Change ability consumes both structured sibling IDs",
  );

  const playerRepeat = applyQuickDuelPlaytestTransition(
    playerResolved.match,
    { ...playerResolved.match, locationId: "location-c", pendingChoice: null },
    noCards,
  );
  assert.equal(playerRepeat.pendingChoice, null);
  assert.deepEqual(playerRepeat.player.hand, ["player-d2"]);
  assert.deepEqual(playerRepeat.player.discard, ["player-h1"]);

  const aiStart = match(
    board(),
    board({ fighterId: "DDB-CHR-CORE-039", hand: ["ai-h1"], deck: ["ai-d1", "ai-d2"] }),
    { phase: "ai-ready", turnIndex: 1 },
  );
  const aiHosted = applyQuickDuelPlaytestTransition(
    aiStart,
    { ...aiStart, locationId: "location-b" },
    noCards,
  );
  assert.equal(aiHosted.pendingChoice, null);
  assert.deepEqual(aiHosted.ai.hand, ["ai-d2"]);
  assert.deepEqual(aiHosted.ai.discard, ["ai-h1"]);
  assert.deepEqual(aiHosted.ai.deck, ["ai-d1"]);
  assert.deepEqual(
    aiHosted.ai.usedCharacterEffectIdsThisRound,
    ["character-venue-draw", "character-venue-discard"],
    "AI consumes the same logical ability siblings as the player",
  );

  const aiRepeat = applyQuickDuelPlaytestTransition(
    aiHosted,
    { ...aiHosted, locationId: "location-c" },
    noCards,
  );
  assert.deepEqual(aiRepeat.ai.hand, ["ai-d2"]);
  assert.deepEqual(aiRepeat.ai.discard, ["ai-h1"]);
  assert.deepEqual(
    aiRepeat.ai.usedCharacterEffectIdsThisRound,
    ["character-venue-draw", "character-venue-discard"],
  );
});
