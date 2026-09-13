import assert from "node:assert/strict";
import test from "node:test";
import { applyQuickDuelStructuredTransition } from "../app/quick-duel-transition-host.ts";
import {
  awardProvisionalTrainingStripe,
  finalizeTrainingStripe,
  reconcileProvisionalTrainingStripe,
  synchronizeTrainingStripeBelt,
  trainingStripeState,
} from "../app/training-stripes.ts";

const config = {
  rule: {
    enabled: true,
    awardAt: "belt-check",
    maxHeld: 3,
    maxAwardsPerBelt: 3,
    clearOnPromotion: true,
    eligibility: {
      requiresNextBeltXp: true,
      requiresIncompleteNextBeltExam: true,
    },
  },
  beltThresholds: [0, 3, 6, 9],
};

function stripeBoard(overrides = {}) {
  return {
    xp: 3,
    belt: 0,
    completedTasks: [],
    characterMarks: {},
    ...overrides,
  };
}

test("an XP-qualified fighter gains one provisional stripe while the next exam is incomplete", () => {
  const first = awardProvisionalTrainingStripe(stripeBoard(), config);
  assert.deepEqual(trainingStripeState(first), { beltIndex: 0, held: 1, awarded: 1, provisional: true });

  const duplicate = awardProvisionalTrainingStripe(first, config);
  assert.deepEqual(trainingStripeState(duplicate), trainingStripeState(first));
});

test("a provisional stripe is revoked if the exam completes before Belt Check", () => {
  const awarded = awardProvisionalTrainingStripe(stripeBoard(), config);
  const completed = { ...awarded, completedTasks: [1] };
  const reconciled = reconcileProvisionalTrainingStripe(completed, config);
  assert.deepEqual(trainingStripeState(reconciled), { beltIndex: 0, held: 0, awarded: 0, provisional: false });
});

test("training stripes accumulate across Belt Checks but never exceed three awards per Belt", () => {
  let board = stripeBoard();
  for (let index = 0; index < 5; index += 1) {
    board = finalizeTrainingStripe(awardProvisionalTrainingStripe(board, config));
  }
  assert.deepEqual(trainingStripeState(board), { beltIndex: 0, held: 3, awarded: 3, provisional: false });
});

test("promotion clears stripes for the newly earned Belt", () => {
  let board = finalizeTrainingStripe(awardProvisionalTrainingStripe(stripeBoard(), config));
  board = { ...board, belt: 1, xp: 6 };
  board = synchronizeTrainingStripeBelt(board, config.rule);
  assert.deepEqual(trainingStripeState(board), { beltIndex: 1, held: 0, awarded: 0, provisional: false });
});

function transitionBoard(overrides = {}) {
  return {
    hand: [],
    discard: [],
    cardsThisTurn: [],
    zonesPlayed: [],
    equipment: [],
    tempSpeed: 0,
    cardsBought: 0,
    xp: 3,
    belt: 0,
    completedTasks: [],
    characterMarks: {},
    ...overrides,
  };
}

function transitionMatch(overrides = {}) {
  return {
    player: transitionBoard(),
    ai: transitionBoard({ xp: 0 }),
    market: [],
    round: 1,
    phase: "player-yell",
    turnOrder: ["player", "ai"],
    turnIndex: 0,
    lastExchange: null,
    ...overrides,
  };
}

const lookup = () => undefined;

test("Quick Duel stages the stripe when Ascend begins so it is visible during Belt Check", () => {
  const previous = transitionMatch();
  const next = transitionMatch({ phase: "player-ascend" });
  const derived = applyQuickDuelStructuredTransition(previous, next, lookup);
  assert.deepEqual(trainingStripeState(derived.player), { beltIndex: 0, held: 1, awarded: 1, provisional: true });
});

test("Quick Duel removes the staged stripe when an Ascend action completes the exam", () => {
  const previous = transitionMatch();
  const entered = applyQuickDuelStructuredTransition(previous, transitionMatch({ phase: "player-ascend" }), lookup);
  const taskCompleted = {
    ...entered,
    player: { ...entered.player, completedTasks: [1] },
  };
  const reconciled = applyQuickDuelStructuredTransition(entered, taskCompleted, lookup);
  assert.deepEqual(trainingStripeState(reconciled.player), { beltIndex: 0, held: 0, awarded: 0, provisional: false });
});
