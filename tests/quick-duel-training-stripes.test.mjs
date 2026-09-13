import assert from "node:assert/strict";
import test from "node:test";
import { quickDuelBeltCheckActionAvailability } from "../app/quick-duel-belt-check-actions.ts";
import { canonicalBeltCheckActionRule, canonicalTrainingStripeConfig } from "../app/training-stripes-config.ts";
import {
  quickDuelTrainingStripeHealingAvailability,
  spendQuickDuelTrainingStripeForHealing,
} from "../app/quick-duel-training-stripes.ts";
import { trainingStripeState, withTrainingStripeState } from "../app/training-stripes.ts";

const stripeState = {
  beltIndex: 1,
  held: 2,
  awarded: 2,
  provisional: false,
  spentTurnKey: null,
  spendsThisTurn: 0,
};

function board(overrides = {}, state = stripeState) {
  return withTrainingStripeState({
    belt: 1,
    xp: 8,
    hp: 17,
    maxHp: 25,
    completedTasks: [],
    characterMarks: {},
    ...overrides,
  }, state);
}

function match(overrides = {}) {
  return {
    player: board(),
    ai: board({ hp: 21 }),
    round: 5,
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    ...overrides,
  };
}

test("canonical Belt Check grants exactly one action between promotion and recovery", () => {
  assert.deepEqual(canonicalBeltCheckActionRule, {
    usesPerTurn: 1,
    choices: ["promote", "training-stripe-recovery"],
    summary: "During Belt Check, choose at most one certification action per turn: promote if eligible, or spend a previously earned Training Stripe to recover HP. Choosing either uses your Belt Check action for that turn.",
  });
});

test("canonical stripe spend rule is 1 finalized stripe for 2 HP, once per turn", () => {
  assert.deepEqual(canonicalTrainingStripeConfig.rule.spend, {
    enabled: true,
    spendAt: "belt-check",
    stripeCost: 1,
    healHp: 2,
    usesPerTurn: 1,
    cannotExceedMaxHp: true,
    requiresFinalizedStripe: true,
  });
});

test("active player can spend at Belt Check and receives canonical healing", () => {
  const current = match();
  assert.equal(quickDuelTrainingStripeHealingAvailability(current, "player", "belt-check").canSpend, true);
  const next = spendQuickDuelTrainingStripeForHealing(current, "player", "belt-check");
  assert.equal(next.player.hp, 19);
  assert.equal(trainingStripeState(next.player).held, 1);
});

test("stripe recovery consumes the Belt Check action and blocks promotion that turn", () => {
  const next = spendQuickDuelTrainingStripeForHealing(match(), "player", "belt-check");
  assert.equal(quickDuelBeltCheckActionAvailability(next, "player", "promote").canUse, false);
  assert.equal(quickDuelBeltCheckActionAvailability(next, "player", "promote").state.action, "training-stripe-recovery");
});

test("same player cannot spend a second stripe during the same turn", () => {
  const first = spendQuickDuelTrainingStripeForHealing(match(), "player", "belt-check");
  const second = spendQuickDuelTrainingStripeForHealing(first, "player", "belt-check");
  assert.equal(second.player.hp, 19);
  assert.equal(trainingStripeState(second.player).held, 1);
});

test("inactive fighter cannot spend a stripe during the active player's Belt Check", () => {
  const current = match();
  assert.equal(quickDuelTrainingStripeHealingAvailability(current, "ai", "belt-check").canSpend, false);
  assert.equal(spendQuickDuelTrainingStripeForHealing(current, "ai", "belt-check"), current);
});

test("a newly staged stripe is visible but not spendable until a later turn", () => {
  const provisionalState = { ...stripeState, held: 1, awarded: 1, provisional: true };
  const current = match({ player: board({}, provisionalState) });
  const availability = quickDuelTrainingStripeHealingAvailability(current, "player", "belt-check");
  assert.equal(availability.state.held, 1);
  assert.equal(availability.spendableHeld, 0);
  assert.equal(availability.canSpend, false);
  assert.equal(spendQuickDuelTrainingStripeForHealing(current, "player", "belt-check"), current);
});

test("a prior stripe can be spent while this turn's staged stripe remains reserved", () => {
  const mixedState = { ...stripeState, held: 2, awarded: 2, provisional: true };
  const current = match({ player: board({}, mixedState) });
  const availability = quickDuelTrainingStripeHealingAvailability(current, "player", "belt-check");
  assert.equal(availability.spendableHeld, 1);
  assert.equal(availability.canSpend, true);
  const next = spendQuickDuelTrainingStripeForHealing(current, "player", "belt-check");
  assert.equal(next.player.hp, 19);
  assert.deepEqual(trainingStripeState(next.player), {
    ...mixedState,
    held: 1,
    spentTurnKey: "5:player",
    spendsThisTurn: 1,
  });
});
