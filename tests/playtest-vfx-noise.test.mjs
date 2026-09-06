import assert from "node:assert/strict";
import test from "node:test";
import { derivePlaytestEvents } from "../src/playtest-events.ts";

function board(overrides = {}) {
  return {
    hp: 25,
    maxHp: 25,
    xp: 0,
    focus: 0,
    focusGeneratedThisTurn: 0,
    focusSpentThisTurn: 0,
    belt: 0,
    hand: [],
    discard: [],
    playArea: [],
    destroyed: [],
    exhaustedEquipment: [],
    attacksThisTurn: 0,
    zonesPlayed: [],
    tempo: true,
    nextAttackHasFlow: false,
    flowUsedThisTurn: false,
    cardsBought: 0,
    completedTasks: [],
    completedBeltExamThisRound: false,
    triggeredCombos: [],
    ...overrides,
  };
}

function match(player) {
  return {
    schema: 8,
    player,
    ai: board(),
    locationId: "loc-a",
    winner: null,
    log: ["older filing"],
  };
}

test("completing an ordinary certification task does not masquerade as a Belt Exam", () => {
  const previous = match(board());
  const next = match(board({ completedTasks: ["task-a"] }));
  const types = derivePlaytestEvents(previous, next).map((event) => event.type);
  assert.equal(types.includes("progress.beltExam"), false);
});

test("actual Belt Exam completion still emits exactly one Belt Exam event", () => {
  const previous = match(board({ completedTasks: ["task-a"] }));
  const next = match(board({ completedTasks: ["task-a", "task-b"], completedBeltExamThisRound: true }));
  assert.deepEqual(derivePlaytestEvents(previous, next).filter((event) => event.type === "progress.beltExam"), [
    { type: "progress.beltExam", fighter: "player" },
  ]);
});
