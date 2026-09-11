import assert from "node:assert/strict";
import test from "node:test";
import { activateQuickDuelRuntimeStatusesForEvent } from "../app/quick-duel-game-host.ts";

function board(overrides = {}) {
  return {
    hp: 10,
    maxHp: 10,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextAttackHasFlow: false,
    nextAttackAnyZone: false,
    damageTaken: 0,
    hand: [],
    discard: [],
    stage3cStatuses: [],
    stage3cChoices: [],
    stage3cRestrictions: [],
    ...overrides,
  };
}

const operations = { draw: (state) => state };
const delayedAttack = {
  sourceEffectId: "future-attack-bonus",
  effect: "combat.modifyAttackPower",
  target: "self",
  amount: 3,
  duration: "nextAttack",
  qualifier: { activateAt: "nextTurnAttack", nextAttack: true, nextTurn: true },
  appliedImmediately: false,
};

test("nextTurnAttack status does not fire on another Attack in the same turn", () => {
  const boards = { self: board({ stage3cStatuses: [delayedAttack] }), opponent: board() };
  const sameTurn = activateQuickDuelRuntimeStatusesForEvent(boards, "onAttackDeclared", "player", operations);
  assert.equal(sameTurn.boards.self.nextAttackBonus, 0);
  assert.equal(sameTurn.boards.self.stage3cStatuses.length, 1);
  assert.deepEqual(sameTurn.commands, []);
});

test("nextTurnAttack status fires exactly when the host marks the later-turn Attack", () => {
  const boards = { self: board({ stage3cStatuses: [delayedAttack] }), opponent: board() };
  const nextTurn = activateQuickDuelRuntimeStatusesForEvent(boards, "onAttackDeclared", "player", operations, { nextTurn: true });
  assert.equal(nextTurn.boards.self.nextAttackBonus, 3);
  assert.equal(nextTurn.boards.self.stage3cStatuses.length, 0);
  assert.deepEqual(nextTurn.commands.map((command) => command.sourceEffectId), ["future-attack-bonus"]);

  const duplicate = activateQuickDuelRuntimeStatusesForEvent(nextTurn.boards, "onAttackDeclared", "player", operations, { nextTurn: true });
  assert.equal(duplicate.boards.self.nextAttackBonus, 3);
  assert.deepEqual(duplicate.commands, []);
});
