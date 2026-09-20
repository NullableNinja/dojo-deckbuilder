import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyQuickDuelPlaytestTransition,
  prepareQuickDuelPlaytestAttack,
  publishQuickDuelPlaytestLifecycleEvent,
  resolveQuickDuelPlaytestCharacterChoice,
} from "../app/quick-duel-playtest-host.ts";
import { chooseAiReactionItem, resolveQuickDuelReactionItem, resolveReactionItemIncomingAttackOutcome } from "../app/reaction-item-runtime.ts";
import { resolveNextDamagePreventionStatuses } from "../app/structured-damage-prevention.ts";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const cards = (await readJson("../content/cards.json")).cards ?? [];
const comboEffects = (await readJson("../content/card-effects/combos.json")).cards ?? {};
const characterEffects = (await readJson("../content/card-effects/characters.json")).cards ?? {};
const reactionEffects = (await readJson("../content/card-effects/reactions.json")).cards ?? {};
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
  const candidates = Object.entries(comboEffects)
    .filter(([, entry]) => entry.effects?.some((effect) => effect.effect === "combat.piercing" && effect.amount === 2 && effect.trigger === "onAttackDeclared"))
    .map(([catalogId]) => byCatalogId.get(catalogId))
    .filter(Boolean);
  assert.ok(candidates.length, "canonical structured effects must contain a piercing Combo fixture");

  const form = kata("form");
  const strike = attack("strike", "Mid");
  let executed = null;
  for (const combo of candidates) {
    const current = match(board({ learnedCombos: [combo.id], cardsThisTurn: [form.id] }));
    const prepared = prepareQuickDuelPlaytestAttack(current, "player", strike, "Mid", lookupWith(form, strike), operations);
    if (prepared.attackFacts.piercing === 2 && prepared.match.player.triggeredCombos.includes(combo.id)) {
      executed = { combo, prepared };
      break;
    }
  }
  assert.ok(executed, "a canonical piercing Combo must execute through the host for the representative Kata → Attack sequence");
  assert.equal(executed.prepared.match.ai.triggeredCombos.length, 0);
});

test("canonical Reaction Items execute through the Quick Duel declaration host for player and AI", () => {
  const reactionCard = (resolver) => {
    const catalogId = Object.entries(reactionEffects)
      .find(([, entry]) => entry.effects?.some((effect) => effect.resolver === resolver))?.[0];
    assert.ok(catalogId, `canonical Reaction Item registry must expose ${resolver}`);
    const card = byCatalogId.get(catalogId);
    assert.ok(card, `canonical catalog must expose ${catalogId}`);
    return card;
  };
  const wetFloor = reactionCard("reaction.reduceDeclaredAttackPower");
  const elbowPad = reactionCard("reaction.preventIncomingDamage");
  const foldingMat = reactionCard("reaction.defenseAgainstIncomingAttack");
  const witness = reactionCard("reaction.secondNormalAttackPenaltyAndInitiateDraw");
  const xrayCatalogId = Object.entries(reactionEffects)
    .find(([, entry]) => entry.effects?.some((effect) => effect.resolver === "reaction.preventIncomingDamage" && effect.amount === 0))?.[0];
  const xray = byCatalogId.get(xrayCatalogId);
  assert.ok(xray, "canonical Reaction Item registry must expose zero-damage prevention");

  const incomingLow = { incomingAttackTargetsSelf: true, incomingZones: ["Low"] };
  const playerWetFloor = resolveQuickDuelReactionItem({
    card: wetFloor,
    self: board({ hand: [wetFloor.id] }),
    opponent: board({ fighterId: "ai-fighter" }),
    strike: { attackPower: 8, zone: "Low" },
    trigger: "onAttackDeclared",
    context: incomingLow,
  });
  assert.equal(playerWetFloor.applied, true);
  assert.equal(playerWetFloor.strike.attackPower, 5);
  assert.ok(!playerWetFloor.self.hand.includes(wetFloor.id));
  assert.ok(playerWetFloor.self.destroyed.includes(wetFloor.id));

  const playerMat = resolveQuickDuelReactionItem({
    card: foldingMat,
    self: board({ hand: [foldingMat.id] }),
    opponent: board({ fighterId: "ai-fighter" }),
    strike: { attackPower: 8, zone: "Mid" },
    trigger: "onAttackDeclared",
    context: { incomingAttackTargetsSelf: true, incomingZones: ["Mid"] },
  });
  assert.equal(playerMat.self.stage3cStatuses[0].effect, "combat.modifyDefense");
  assert.equal(playerMat.self.stage3cStatuses[0].duration, "nextIncomingAttack");

  const witnessStatement = resolveQuickDuelReactionItem({
    card: witness,
    self: board({ hand: [witness.id] }),
    opponent: board({ fighterId: "ai-fighter", attacksThisTurn: 2 }),
    strike: { attackPower: 8, zone: "Mid" },
    trigger: "onAttackDeclared",
    context: { incomingAttackTargetsSelf: true, incomingZones: ["Mid"], attackNumber: 2, currentAttackIsNormal: true },
  });
  assert.equal(witnessStatement.strike.attackPower, 6);
  const witnessHit = resolveReactionItemIncomingAttackOutcome(witnessStatement.self, true);
  assert.equal(witnessHit.stage3cStatuses[0].qualifier.activateAt, "nextInitiate");
  assert.equal(resolveReactionItemIncomingAttackOutcome(witnessStatement.self, false).stage3cStatuses.length, 0);

  const aiChoice = chooseAiReactionItem([elbowPad, xray], { incomingAttackTargetsSelf: true, incomingZones: ["High"] });
  assert.equal(aiChoice.id, xray.id, "AI picks the strongest legal canonical prevention plan");
  const aiXray = resolveQuickDuelReactionItem({
    card: aiChoice,
    self: board({ fighterId: "ai-fighter", hand: [aiChoice.id] }),
    opponent: board(),
    strike: { attackPower: 9, zone: "High" },
    trigger: "onAttackDeclared",
    context: { incomingAttackTargetsSelf: true, incomingZones: ["High"] },
  });
  const prevented = resolveNextDamagePreventionStatuses(aiXray.self.stage3cStatuses, 9, "Attack");
  assert.equal(prevented.damage, 0);
  assert.ok(aiXray.self.destroyed.includes(xray.id));
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
  const borrowerCatalogId = Object.entries(characterEffects).find(([, entry]) =>
    entry.effects?.some((effect) => effect.resolver === "character.equipDiscardPermanentUntilHide"))?.[0];
  assert.ok(borrowerCatalogId, "canonical structured effects must contain the temporary discard-equipment Character resolver");
  const permanent = cards.find((card) => ["Weapon", "Defense Equipment", "Gear"].includes(card.subtype));
  assert.ok(permanent, "canonical catalog must contain permanent Equipment");
  const opponent = cards.find((card) => card.cardType === "Character" && card.catalogId !== borrowerCatalogId);
  const current = match(
    board({ fighterId: borrowerCatalogId, discard: [permanent.id] }),
    board({ fighterId: opponent?.catalogId ?? "ai-fighter" }),
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
