import assert from "node:assert/strict";
import test from "node:test";
import {
  beltCheckActionAvailability,
  beltCheckActionState,
  markBeltCheckAction,
} from "../app/belt-check-actions.ts";

const rule = {
  usesPerTurn: 1,
  choices: ["promote", "training-stripe-recovery"],
};

function board(overrides = {}) {
  return { characterMarks: {}, ...overrides };
}

test("Belt Check starts with one certification action available", () => {
  const current = board();
  assert.equal(beltCheckActionAvailability(current, rule, "4:player", "promote").canUse, true);
  assert.equal(beltCheckActionAvailability(current, rule, "4:player", "training-stripe-recovery").canUse, true);
});

test("using recovery blocks promotion for the rest of the same turn", () => {
  const current = markBeltCheckAction(board(), rule, "4:player", "training-stripe-recovery");
  assert.deepEqual(beltCheckActionState(current, "4:player"), {
    turnKey: "4:player",
    usesThisTurn: 1,
    action: "training-stripe-recovery",
  });
  assert.equal(beltCheckActionAvailability(current, rule, "4:player", "promote").canUse, false);
});

test("using promotion blocks recovery for the rest of the same turn", () => {
  const current = markBeltCheckAction(board(), rule, "4:player", "promote");
  assert.equal(beltCheckActionAvailability(current, rule, "4:player", "training-stripe-recovery").canUse, false);
});

test("a new turn restores the Belt Check action budget", () => {
  const current = markBeltCheckAction(board(), rule, "4:player", "training-stripe-recovery");
  assert.equal(beltCheckActionAvailability(current, rule, "5:player", "promote").canUse, true);
  assert.deepEqual(beltCheckActionState(current, "5:player"), {
    turnKey: "5:player",
    usesThisTurn: 0,
    action: null,
  });
});
