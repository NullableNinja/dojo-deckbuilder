import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { comboPlanForHost } from "../app/combo-playtest-bridge.ts";
import {
  activateQuickDuelComboPlan,
  closeQuickDuelComboExecution,
  publishQuickDuelComboTrigger,
  resolveQuickDuelComboChoice,
} from "../app/quick-duel-combo-executor.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const executorSource = await readFile(new URL("../app/quick-duel-combo-executor.ts", import.meta.url), "utf8");
const combo = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);
const attack = (id, tags = [], zone = "Mid") => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const kata = (id, tags = [], focusValue = 1) => ({ id, name: id, cardType: "Technique", subtype: "Kata", tags, focusValue });
const consumable = (id) => ({ id, name: id, cardType: "Item", subtype: "Consumable", tags: ["Consumable"] });
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

test("Combo executor is identity-free and consumes structured plans only", () => {
  assert.doesNotMatch(executorSource, /DDB-CMB-CORE-|Aisle-Three|Improvised Curriculum|rulesText|Requirement:|Payoff:/);
  assert.match(executorSource, /ComboHostPlan/);
  assert.match(executorSource, /commandsByTrigger/);
  assert.match(executorSource, /deferredOnCompletion/);
});

test("a completed Combo remains active for canonical later triggers", () => {
  const first = attack("high", [], "High");
  const current = attack("low", [], "Low");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-016"), context(current, {
    priorCards: [first],
    attacksThisTurn: 1,
    zonesPlayed: ["High"],
    currentZone: "Low",
    equipment: [weapon("flex", ["Flexible"])],
  }), "onAttackDeclared");
  assert.equal(plan.requirement.eligible, true);

  const activated = activateQuickDuelComboPlan(plan, "onAttackDeclared");
  assert.ok(activated.commands.some((command) => command.sourceEffectId === "combo-flexible-schedule-power"));
  assert.equal(activated.execution.runtime.self.attack, 2);

  const hit = publishQuickDuelComboTrigger(activated.execution, "onHit");
  assert.ok(hit.commands.some((command) => command.sourceEffectId === "combo-flexible-schedule-speed"));
  assert.equal(hit.execution.runtime.opponent.speed, -1);
  assert.ok(hit.execution.runtime.statuses.some((status) => status.sourceEffectId === "combo-flexible-schedule-speed" && status.duration === "nextHonor"));

  const duplicateHit = publishQuickDuelComboTrigger(hit.execution, "onHit");
  assert.equal(duplicateHit.commands.length, 0, "the same Combo trigger must not execute twice");
});

test("non-Attack Combo completion can resolve an afterResolve payoff", () => {
  const first = attack("one", [], "High");
  const second = attack("two", [], "Mid");
  const drink = consumable("drink");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-049"), context(drink, {
    priorCards: [first, second],
    attacksThisTurn: 2,
    zonesPlayed: ["High", "Mid"],
  }), "onPlay");
  assert.equal(plan.requirement.eligible, true);

  const activated = activateQuickDuelComboPlan(plan, "onPlay");
  assert.equal(activated.commands.length, 0);
  const resolved = publishQuickDuelComboTrigger(activated.execution, "afterResolve");
  assert.deepEqual(resolved.commands.map((command) => [command.effect, command.amount]).sort(), [
    ["core.discard", 1],
    ["core.draw", 2],
  ].sort());
  assert.equal(resolved.execution.runtime.self.draw, 2);
  assert.equal(resolved.execution.runtime.self.discard, 1);
});

test("deferred Combo effects install structured future statuses at completion", () => {
  const current = attack("mid", [], "Mid");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-013"), context(current, {
    currentZone: "Mid",
    currentAttackHit: true,
    playedCardFacts: [{ window: "sinceLastTurn", card: defense("guard", ["Guard"]) }],
  }), "onHit");
  assert.equal(plan.requirement.eligible, true);

  const activated = activateQuickDuelComboPlan(plan, "onHit");
  assert.deepEqual(activated.execution.queuedEffectIds.slice().sort(), [
    "combo-comment-period-guard-penalty",
    "combo-comment-period-power-penalty",
  ]);
  assert.equal(activated.execution.runtime.statuses.length, 2);
  assert.ok(activated.execution.runtime.statuses.every((status) => status.qualifier?.nextReaction));
});

test("structured Combo choices gate their canonical follow-up without identity dispatch", () => {
  const current = attack("swing", [], "Mid");
  const improvised = weapon("improvised", ["Improvised"]);
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-022"), context(current, {
    equipment: [improvised],
  }), "onAttackDeclared");
  assert.equal(plan.requirement.eligible, true);

  const activated = activateQuickDuelComboPlan(plan, "onAttackDeclared");
  assert.equal(activated.execution.pendingChoice?.filter.tag, "Weapon");
  assert.equal(activated.execution.runtime.self.attack, 0);

  const rejected = resolveQuickDuelComboChoice(activated.execution, combo("DDB-CMB-CORE-022"), kata("not-weapon"));
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.execution.pendingChoice?.filter.tag, "Weapon");

  const selected = weapon("hand-weapon", ["Improvised"]);
  const accepted = resolveQuickDuelComboChoice(activated.execution, combo("DDB-CMB-CORE-022"), selected);
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.action, { action: "discard", cardId: "hand-weapon" });
  assert.equal(accepted.execution.pendingChoice, null);
  assert.deepEqual(accepted.commands.map((command) => command.sourceEffectId), ["combo-improvised-curriculum-power"]);
  assert.equal(accepted.execution.runtime.self.attack, 4);
});

test("closing a Combo execution retires transient plan state but preserves queued runtime statuses", () => {
  const current = attack("mid", [], "Mid");
  const plan = comboPlanForHost(combo("DDB-CMB-CORE-013"), context(current, {
    currentZone: "Mid",
    currentAttackHit: true,
    playedCardFacts: [{ window: "sinceLastTurn", card: defense("guard", ["Guard"]) }],
  }), "onHit");
  const activated = activateQuickDuelComboPlan(plan, "onHit");
  const closed = closeQuickDuelComboExecution(activated.execution);
  assert.equal(closed.active, false);
  assert.equal(closed.pendingChoice, null);
  assert.equal(closed.runtime.statuses.length, 2);
});
