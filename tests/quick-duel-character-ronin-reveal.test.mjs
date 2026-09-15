import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyCharacterRuntimeEvent } from "../app/character-runtime.ts";
import { publishQuickDuelPlaytestReveal } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-029",
    belt: 3,
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackAnyZone: false,
    nextAttackHasFlow: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: [],
    deck: [],
    discard: [],
    destroyed: [],
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
    ...overrides,
  };
}

const opponent = board({ fighterId: "DDB-CHR-CORE-001" });
const marketCard = { id: "market-visible", name: "Visible Market Card", cardType: "Item", subtype: "Gear", tags: [] };
const locationCard = { id: "location-visible", name: "Visible Location", cardType: "Location", subtype: "Location", tags: [] };

test("Ronin offers the once-per-game reroll without exposing a hidden replacement id", () => {
  const first = applyCharacterRuntimeEvent(board(), opponent, {
    type: "reveal",
    card: marketCard,
    revealSource: "market",
    replacementAvailable: true,
  }, "player");
  assert.equal(first.choices.length, 1);
  assert.equal(first.choices[0].selectionField, "optionalAccepted");
  assert.equal(first.event.replacementId, undefined);
  assert.equal(first.event.selectedId, undefined);
  assert.equal(first.event.replacementRequested, undefined);

  const accepted = applyCharacterRuntimeEvent(first.self, first.opponent, {
    ...first.event,
    optionalAccepted: true,
  }, "player");
  assert.equal(accepted.choices.length, 0);
  assert.equal(accepted.event.replacementRequested, true);
  assert.equal(accepted.event.replacementId, undefined);
  assert.ok(accepted.self.usedCharacterEffectIdsThisGame.includes("character-ronin-reroll"));
});

test("Ronin cannot request a reroll when the same deck has no replacement", () => {
  const result = applyCharacterRuntimeEvent(board(), opponent, {
    type: "reveal",
    card: marketCard,
    revealSource: "market",
    replacementAvailable: false,
  }, "player");
  assert.equal(result.choices.length, 0);
  assert.equal(result.event.replacementRequested, undefined);
});

test("Ronin's Green linked effect awards exactly 1 XP after a resolved Location replacement", () => {
  const result = applyCharacterRuntimeEvent(board({ xp: 4 }), opponent, {
    type: "reveal",
    card: locationCard,
    revealSource: "location",
    replacementAvailable: true,
    replacementResolved: true,
  }, "player");
  assert.equal(result.self.xp, 5);
});

test("Ronin's Green linked effect does not award XP for a Market replacement", () => {
  const result = applyCharacterRuntimeEvent(board({ xp: 4 }), opponent, {
    type: "reveal",
    card: marketCard,
    revealSource: "market",
    replacementAvailable: true,
    replacementResolved: true,
  }, "player");
  assert.equal(result.self.xp, 4);
});

test("Ronin's once-per-game reroll stays consumed after the first accepted reveal", () => {
  const consumed = board({ usedCharacterEffectIdsThisGame: ["character-ronin-reroll"] });
  const result = applyCharacterRuntimeEvent(consumed, opponent, {
    type: "reveal",
    card: locationCard,
    revealSource: "location",
    replacementAvailable: true,
  }, "player");
  assert.equal(result.choices.length, 0);
  assert.equal(result.event.replacementRequested, undefined);
});


test("Quick Duel reveal host surfaces the player decision without exposing a replacement id", () => {
  const match = { player: board(), ai: opponent };
  const result = publishQuickDuelPlaytestReveal(match, "player", {
    cardId: "market-visible",
    revealSource: "market",
    replacementAvailable: true,
  }, (id) => id === "market-visible" ? marketCard : null);
  assert.equal(result.choices.length, 1);
  assert.equal(result.event?.replacementId, undefined);
  assert.equal(result.event?.replacementRequested, undefined);
});

test("Quick Duel reveal host auto-resolves the same legal Ronin choice for AI", () => {
  const match = { player: opponent, ai: board() };
  const result = publishQuickDuelPlaytestReveal(match, "ai", {
    cardId: "location-visible",
    revealSource: "location",
    replacementAvailable: true,
  }, (id) => id === "location-visible" ? locationCard : null);
  assert.equal(result.choices.length, 0);
  assert.equal(result.event?.replacementRequested, true);
  assert.ok(result.match.ai.usedCharacterEffectIdsThisGame.includes("character-ronin-reroll"));
});

test("Playtest routes real Market and Honor reveals through the generic reveal host", () => {
  const source = readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /hostQuickDuelPublicReveal\(purchased, "market", revealedId\)/);
  assert.match(source, /hostQuickDuelPublicReveal\(advanced, "location", locationId\)/);
  assert.match(source, /continuePublicRevealAfterPlayerChoice\(logged, resolved\.event\)/);
  assert.doesNotMatch(source, /DDB-CHR-CORE-029|Ronin Reroll/);
});
