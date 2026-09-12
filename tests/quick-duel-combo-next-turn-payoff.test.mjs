import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { comboPlanForHost } from "../app/combo-playtest-bridge.ts";
import { activateQuickDuelComboOnBoards } from "../app/quick-duel-combo-session-host.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const combo = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);
const attack = (id, tags = [], zone = "Mid") => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const defense = (id, tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Defense", tags, zone: "Any" });

function context(currentCard, overrides = {}) {
  return {
    priorCards: [], attacksThisTurn: 0, defendedThisRound: false, blockedThisRound: false, hitThisTurn: false,
    hitZonesThisTurn: [], zonesPlayed: [], roundZonesPlayed: [], roundAttackHits: 0, equipment: [], startingHand: [],
    currentCard, currentZone: currentCard.zone ?? "Mid", currentAttackHit: false, currentDefense: null,
    currentDefenseBlocked: false, completedBeltExamThisRound: false, triggeredComboIds: [], previousAttackBlocked: false,
    blockFacts: [], speedGainWindows: [], purchaseFacts: [], playedCardFacts: [], attackFacts: [], ...overrides,
  };
}

function board(overrides = {}) {
  return { hp: 10, maxHp: 10, xp: 0, focus: 0, tempSpeed: 0, nextAttackBonus: 0, nextAttackHasFlow: false,
    nextAttackAnyZone: false, damageTaken: 0, hand: [], discard: [], stage3cStatuses: [], stage3cChoices: [],
    stage3cRestrictions: [], ...overrides };
}

const operations = { draw: (state) => state };

test("No, YOU Come Here resolves its next-turn Attack payoff on the Attack that completes its requirement", () => {
  const current = attack("next-turn-attack", ["Punch"], "Mid");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-028"), context(current, {
    blockFacts: [{ window: "sinceLastTurn", defenseTags: ["Parry"], incomingZone: "High" }],
  }), "onAttackDeclared");
  assert.equal(plan.requirement.eligible, true);
  const activated = activateQuickDuelComboOnBoards({ self: board(), opponent: board() }, plan, "onAttackDeclared", "player", operations);
  assert.equal(activated.boards.self.nextAttackBonus, 3);
  assert.ok(activated.execution.executedEffectIds.includes("combo-no-you-come-here-power"));
  assert.ok(!activated.execution.queuedEffectIds.includes("combo-no-you-come-here-power"));
  assert.ok(!(activated.boards.self.stage3cStatuses ?? []).some((status) => status.sourceEffectId === "combo-no-you-come-here-power"));
});

test("Wing It still defers its payoff when the Combo completes before the next-turn Attack", () => {
  const parryOne = defense("parry-one", ["Parry"]);
  const parryTwo = defense("parry-two", ["Parry"]);
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-053"), context(parryTwo, {
    currentDefense: parryTwo, currentDefenseBlocked: true, defendedThisRound: true,
    playedCardFacts: [{ window: "round", card: parryOne }, { window: "round", card: parryTwo }],
  }), "onDefenseDeclared");
  assert.equal(plan.requirement.eligible, true);
  const activated = activateQuickDuelComboOnBoards({ self: board(), opponent: board() }, plan, "onDefenseDeclared", "player", operations);
  assert.equal(activated.boards.self.nextAttackBonus, 0);
  assert.ok(activated.execution.queuedEffectIds.includes("combo-wing-it-power"));
  assert.ok((activated.boards.self.stage3cStatuses ?? []).some((status) =>
    status.sourceEffectId === "combo-wing-it-power" && status.qualifier?.activateAt === "nextTurnAttack" && status.duration === "nextAttack"));
});
