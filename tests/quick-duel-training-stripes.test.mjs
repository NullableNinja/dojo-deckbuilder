import assert from "node:assert/strict";
import test from "node:test";
import { canonicalTrainingStripeConfig } from "../app/training-stripes-config.ts";
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

function board(overrides = {}) {
  return withTrainingStripeState({
    belt: 1,
    xp: 8,
    hp: 17,
    maxHp: 25,
    completedTasks: [],
    characterMarks: {},
    ...overrides,
  }, stripeState);
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

test("canonical stripe spend rule is 1 stripe for 2 HP, once per turn", () => {
  assert.deepEqual(canonicalTrainingStripeConfig.rule.spend, {
    enabled: true,
    spendAt: "belt-check",
    stripeCost: 1,
    healHp: 2,
    usesPerTurn: 1,
    cannotExceedMaxHp: true,
  });
});

test("active player can spend at Belt Check and receives canonical healing", () => {
  const current = match();
  assert.equal(quickDuelTrainingStripeHealingAvailability(current, "player", "belt-check").canSpend, true);
  const next = spendQuickDuelTrainingStripeForHealing(current, "player", "belt-check");
  assert.equal(next.player.hp, 19);
  assert.equal(trainingStripeState(next.player).held, 1);
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
