import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyQuickDuelPlaytestTransition,
  prepareQuickDuelPlaytestAttack,
  publishQuickDuelPlaytestCharacterEvent,
  publishQuickDuelPlaytestLifecycleEvent,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";
import { comboHostFactsFromBoard } from "../app/quick-duel-game-host.ts";

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

test("Playtest Attack adapter projects canonical Combo facts without leaking actor orientation into React", () => {
  const combo = byCatalogId.get("DDB-CMB-CORE-024");
  const form = kata("form");
  const strike = attack("strike", "Mid");
  const current = match(board({ learnedCombos: [combo.id], cardsThisTurn: [form.id] }));

  const prepared = prepareQuickDuelPlaytestAttack(current, "player", strike, "Mid", lookupWith(form, strike), operations);
  assert.equal(prepared.attackFacts.piercing, 2);
  assert.ok(prepared.match.player.triggeredCombos.includes(combo.id));
  assert.equal(prepared.match.ai.triggeredCombos.length, 0);
  assert.deepEqual(prepared.match.log, ["preserve-me"]);
});

test("cardless lifecycle publication targets the acting AI board rather than the player board", () => {
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

  const published = publishQuickDuelPlaytestLifecycleEvent(current, "ai", "onInitiate", operations);
  assert.equal(published.match.ai.focus, 2);
  assert.equal(published.match.player.focus, 1);
  assert.equal(published.match.ai.stage3cStatuses.length, 0);
  assert.deepEqual(published.activatedComboIds, []);
});

test("safe Character events resolve through canonical runtime with actor orientation preserved", () => {
  const current = match(
    board({ fighterId: "DDB-CHR-CORE-001" }),
    board({ fighterId: "DDB-CHR-CORE-024", nextAttackBonus: 0 }),
    { phase: "ai-initiate", turnIndex: 1 },
  );

  const published = publishQuickDuelPlaytestCharacterEvent(current, "ai", {
    type: "initiate",
    hasWeaponEquipped: false,
    selectedMode: "attack",
  });
  assert.equal(published.published, true);
  assert.equal(published.conflict, false);
  assert.equal(published.match.ai.nextAttackBonus, 1);
  assert.equal(published.match.player.nextAttackBonus, 0);
  assert.deepEqual(published.match.log, ["preserve-me"]);
});

test("Character choices survive the Playtest host boundary and resume through canonical selection fields", () => {
  const borrowedId = "borrowed-permanent";
  const current = match(
    board({ fighterId: "DDB-CHR-CORE-030", discard: [borrowedId] }),
    board({ fighterId: "DDB-CHR-CORE-001" }),
    { phase: "player-initiate", turnIndex: 0 },
  );

  const offered = publishQuickDuelPlaytestCharacterEvent(current, "player", {
    type: "initiate",
    candidateIds: [borrowedId],
  });

  assert.equal(offered.published, true);
  assert.equal(offered.choices.length, 1);
  assert.equal(offered.choices[0].resolver, "character.equipDiscardPermanentUntilHide");
  assert.equal(offered.choices[0].selectionField, "selectedId");
  assert.deepEqual(offered.choices[0].options, [borrowedId, "skip"]);
  assert.ok(offered.match.player.discard.includes(borrowedId));

  const resolved = resolveQuickDuelPlaytestCharacterChoice(
    offered.match,
    "player",
    offered.event,
    offered.choices[0],
    borrowedId,
  );

  assert.equal(resolved.choices.length, 0);
  assert.equal(resolved.match.player.borrowedEquipmentId, borrowedId);
  assert.ok(resolved.match.player.equipment.includes(borrowedId));
  assert.ok(!resolved.match.player.discard.includes(borrowedId));
  assert.ok(resolved.notes.includes("character.equipDiscardPermanentUntilHide"));

  const hidden = publishQuickDuelPlaytestCharacterEvent(resolved.match, "player", { type: "hide" });
  assert.equal(hidden.match.player.borrowedEquipmentId, null);
  assert.ok(!hidden.match.player.equipment.includes(borrowedId));
  assert.ok(hidden.match.player.discard.includes(borrowedId));
});

test("compatibility-owned Character events are blocked instead of double-resolving", () => {
  const current = match(board({ fighterId: "DDB-CHR-CORE-012" }), board({ fighterId: "DDB-CHR-CORE-001" }));
  const published = publishQuickDuelPlaytestCharacterEvent(current, "player", {
    type: "attackDeclared",
    firstAttackThisTurn: true,
    usedConsumableThisTurn: true,
    attackPower: 2,
    card: attack("compatibility-attack"),
  });
  assert.equal(published.published, false);
  assert.equal(published.conflict, true);
  assert.equal(published.match, current);
  assert.match(published.reason, /compatibility-owned/);
  assert.deepEqual(published.choices, []);
});

test("transition adapter preserves full Playtest match fields while recording structured history", () => {
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
  assert.deepEqual(comboHostFactsFromBoard(hosted.player).turnPlayed.map((fact) => fact.cardId), [form.id]);
});

test("committed Playtest routes every Match setter update through the unified transition host", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /const \[match, setRawMatch\] = useState<Match \| null>/);
  assert.match(source, /const setMatch = \(update: SetStateAction<Match \| null>\) => setRawMatch/);
  assert.match(source, /applyQuickDuelPlaytestTransition\(previous, next, cardFor\)/);
  assert.doesNotMatch(source, /const \[match, setMatch\] = useState<Match \| null>/);
});

test("Playtest adapter remains identity-free and does not parse card prose", async () => {
  const source = await readFile(new URL("../app/quick-duel-playtest-host.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /DDB-(?:CMB|CHR)-CORE-|rulesText|displayText|combo\.name\s*===|catalogId\s*===/);
  assert.match(source, /quick-duel-game-host/);
});
