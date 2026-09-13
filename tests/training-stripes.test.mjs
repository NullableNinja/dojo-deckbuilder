import assert from "node:assert/strict";
import test from "node:test";
import { applyQuickDuelStructuredTransition } from "../app/quick-duel-transition-host.ts";
import {
  awardProvisionalTrainingStripe,
  finalizeTrainingStripe,
  reconcileProvisionalTrainingStripe,
  spendTrainingStripeForHealing,
  synchronizeTrainingStripeBelt,
  trainingStripeHealingAvailability,
  trainingStripeState,
  withTrainingStripeState,
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
    spend: {
      enabled: true,
      spendAt: "belt-check",
      stripeCost: 1,
      healHp: 2,
      usesPerTurn: 1,
      cannotExceedMaxHp: true,
    },
  },
  beltThresholds: [0, 3, 6, 9],
};

function expectedState(overrides = {}) {
  return {
    beltIndex: 0,
    held: 0,
    awarded: 0,
    provisional: false,
    spentTurnKey: null,
    spendsThisTurn: 0,
    ...overrides,
  };
}

function stripeBoard(overrides = {}) {
  return {
    xp: 3,
    belt: 0,
    hp: 18,
    maxHp: 25,
    completedTasks: [],
    characterMarks: {},
    ...overrides,
  };
}

test("an XP-qualified fighter gains one provisional stripe while the next exam is incomplete", () => {
  const first = awardProvisionalTrainingStripe(stripeBoard(), config);
  assert.deepEqual(trainingStripeState(first), expectedState({ held: 1, awarded: 1, provisional: true }));

  const duplicate = awardProvisionalTrainingStripe(first, config);
  assert.deepEqual(trainingStripeState(duplicate), trainingStripeState(first));
});

test("a provisional stripe is revoked if the exam completes before Belt Check", () => {
  const awarded = awardProvisionalTrainingStripe(stripeBoard(), config);
  const completed = { ...awarded, completedTasks: [1] };
  const reconciled = reconcileProvisionalTrainingStripe(completed, config);
  assert.deepEqual(trainingStripeState(reconciled), expectedState());
});

test("training stripes accumulate across Belt Checks but never exceed three awards per Belt", () => {
  let board = stripeBoard();
  for (let index = 0; index < 5; index += 1) {
    board = finalizeTrainingStripe(awardProvisionalTrainingStripe(board, config));
  }
  assert.deepEqual(trainingStripeState(board), expectedState({ held: 3, awarded: 3 }));
});

test("promotion clears stripes for the newly earned Belt", () => {
  let board = finalizeTrainingStripe(awardProvisionalTrainingStripe(stripeBoard(), config));
  board = { ...board, belt: 1, xp: 6 };
  board = synchronizeTrainingStripeBelt(board, config.rule);
  assert.deepEqual(trainingStripeState(board), { ...expectedState(), beltIndex: 1 });
});

test("spending one stripe heals exactly 2 HP and consumes one stripe", () => {
  const striped = withTrainingStripeState(stripeBoard({ hp: 18 }), expectedState({ held: 2, awarded: 2 }));
  const spent = spendTrainingStripeForHealing(striped, config, "round-4:player");
  assert.equal(spent.hp, 20);
  assert.deepEqual(trainingStripeState(spent), expectedState({ held: 1, awarded: 2, spentTurnKey: "round-4:player", spendsThisTurn: 1 }));
});

test("stripe healing can only be used once in the same turn", () => {
  const striped = withTrainingStripeState(stripeBoard({ hp: 18 }), expectedState({ held: 3, awarded: 3 }));
  const first = spendTrainingStripeForHealing(striped, config, "round-4:player");
  const second = spendTrainingStripeForHealing(first, config, "round-4:player");
  assert.equal(second.hp, 20);
  assert.equal(trainingStripeState(second).held, 2);
  assert.equal(trainingStripeHealingAvailability(second, config, "round-4:player").canSpend, false);
});

test("a new turn key allows another stripe heal", () => {
  const striped = withTrainingStripeState(stripeBoard({ hp: 18 }), expectedState({ held: 3, awarded: 3 }));
  const first = spendTrainingStripeForHealing(striped, config, "round-4:player");
  const second = spendTrainingStripeForHealing(first, config, "round-5:player");
  assert.equal(second.hp, 22);
  assert.deepEqual(trainingStripeState(second), expectedState({ held: 1, awarded: 3, spentTurnKey: "round-5:player", spendsThisTurn: 1 }));
});

test("stripe healing never exceeds Max HP", () => {
  const striped = withTrainingStripeState(stripeBoard({ hp: 24, maxHp: 25 }), expectedState({ held: 1, awarded: 1 }));
  const spent = spendTrainingStripeForHealing(striped, config, "round-2:player");
  assert.equal(spent.hp, 25);
  assert.equal(trainingStripeState(spent).held, 0);
});

test("a stripe cannot be spent at full HP", () => {
  const striped = withTrainingStripeState(stripeBoard({ hp: 25, maxHp: 25 }), expectedState({ held: 1, awarded: 1 }));
  const spent = spendTrainingStripeForHealing(striped, config, "round-2:player");
  assert.equal(spent, striped);
  assert.equal(trainingStripeHealingAvailability(striped, config, "round-2:player").atFullHp, true);
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
    hp: 20,
    maxHp: 25,
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
  assert.deepEqual(trainingStripeState(derived.player), expectedState({ held: 1, awarded: 1, provisional: true }));
});

test("Quick Duel removes the staged stripe when an Ascend action completes the exam", () => {
  const previous = transitionMatch();
  const entered = applyQuickDuelStructuredTransition(previous, transitionMatch({ phase: "player-ascend" }), lookup);
  const taskCompleted = {
    ...entered,
    player: { ...entered.player, completedTasks: [1] },
  };
  const reconciled = applyQuickDuelStructuredTransition(entered, taskCompleted, lookup);
  assert.deepEqual(trainingStripeState(reconciled.player), expectedState());
});
