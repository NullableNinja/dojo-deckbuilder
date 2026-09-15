import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyQuickDuelPlaytestTransition,
  prepareQuickDuelPlaytestAttack,
  publishQuickDuelPlaytestLifecycleEvent,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const byCatalogId = new Map(cards.map((card) => [card.catalogId, card]));
const byId = new Map(cards.map((card) => [card.id, card]));
const attack = (id, zone = "Mid") => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags: [], zone });
const kata = (id) => ({ id, name: id, cardType: "Technique", subtype: "Kata", tags: [] });

function board(overrides = {}) {
  return {
    fighterId: "fighter",
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
    damageTaken: 0,
    hand: [],
    deck: [],
    discard: [],
    destroyed: [],
    equipment: [],
    exhaustedEquipment: [],
    cardsThisTurn: [],
    zonesPlayed: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
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
    ...overrides,
  };
}

function match(player = board(), ai = board({ fighterId: "ai-fighter" }), overrides = {}) {
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
    winner: null,
    log: ["preserve-me"],
    ...overrides,
  };
}

const lookupWith = (...extra) => {
  const lookup = new Map(byId);
  for (const card of extra) lookup.set(card.id, card);
  return (id) => lookup.get(id) ?? null;
};

const operations = {
  draw: (state, amount) => ({ ...state, drawn: (state.drawn ?? 0) + Math.max(0, amount) }),
};

test("canonical Combo effects execute through the Quick Duel host", () => {
  const combo = byCatalogId.get("DDB-CMB-CORE-024");
  assert.ok(combo, "representative canonical Combo must exist");
  const form = kata("form");
  const strike = attack("strike", "Mid");
  const current = match(board({ learnedCombos: [combo.id], cardsThisTurn: [form.id] }));
  const prepared = prepareQuickDuelPlaytestAttack(current, "player", strike, "Mid", lookupWith(form, strike), operations);
  assert.equal(prepared.attackFacts.piercing, 2);
  assert.ok(prepared.match.player.triggeredCombos.includes(combo.id));
  assert.equal(prepared.match.ai.triggeredCombos.length, 0);
});

test("structured lifecycle effects mutate the acting board only", () => {
  const deferred = {
    sourceEffectId: "deferred-focus",
    effect: "core.gainFocus",
    target: "self",
    amount: 2,
    duration: "nextInitiate",
    qualifier: { activateAt: "nextInitiate" },
    appliedImmediately: false,
  };
  const current = match(board({ focus: 1 }), board({ fighterId: "ai-fighter", focus: 0, stage3cStatuses: [deferred] }), {
    phase: "ai-ready",
    turnIndex: 1,
  });
  const published = publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate", operations, lookupWith());
  assert.equal(published.match.ai.focus, 2);
  assert.equal(published.match.player.focus, 1);
  assert.equal(published.match.ai.stage3cStatuses.length, 0);
});

test("canonical Character choices cross the Quick Duel host and resume through structured selection", () => {
  const permanent = cards.find((card) => ["Weapon", "Defense Equipment", "Gear"].includes(card.subtype));
  assert.ok(permanent, "canonical catalog must contain permanent Equipment");
  const current = match(
    board({ fighterId: "DDB-CHR-CORE-030", discard: [permanent.id] }),
    board({ fighterId: "DDB-CHR-CORE-001" }),
    { phase: "player-initiate", turnIndex: 0 },
  );
  const offered = publishQuickDuelPlaytestLifecycleEvent(current, "player", "onInitiate", operations, lookupWith());
  assert.equal(offered.characterPublished, true);
  assert.equal(offered.characterConflict, false);
  assert.equal(offered.characterChoices.length, 1);
  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    offered.match,
    "player",
    offered.characterEvent,
    offered.characterChoices[0],
    permanent.id,
  );
  assert.equal(resolved.match.player.borrowedEquipmentId, permanent.id);
  assert.ok(resolved.match.player.equipment.includes(permanent.id));
  const hidden = publishQuickDuelPlaytestLifecycleEvent(resolved.match, "player", "onHide", operations, lookupWith());
  assert.equal(hidden.match.player.borrowedEquipmentId, null);
  assert.ok(!hidden.match.player.equipment.includes(permanent.id));
  assert.ok(hidden.match.player.discard.includes(permanent.id));
});

test("Quick Duel transition adapter preserves unrelated match state", () => {
  const form = kata("form-played");
  const previous = match(board({ hand: [form.id] }));
  const next = {
    ...previous,
    player: { ...previous.player, hand: [], cardsThisTurn: [form.id] },
    selectedZone: "Low",
    pendingStrike: null,
  };
  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookupWith(form));
  assert.equal(hosted.selectedZone, "Low");
  assert.equal(hosted.pendingStrike, null);
  assert.deepEqual(hosted.log, ["preserve-me"]);
});
