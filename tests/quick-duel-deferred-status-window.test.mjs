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

test("nextTurnAttack status does not fire on another Attack before the next Initiate", () => {
  const boards = { self: board({ stage3cStatuses: [delayedAttack] }), opponent: board() };
  const sameTurn = activateQuickDuelRuntimeStatusesForEvent(boards, "onAttackDeclared", "player", operations);
  assert.equal(sameTurn.boards.self.nextAttackBonus, 0);
  assert.equal(sameTurn.boards.self.stage3cStatuses.length, 1);
  assert.equal(sameTurn.boards.self.stage3cStatuses[0].qualifier?.nextTurnAttackArmed, undefined);
  assert.deepEqual(sameTurn.commands, []);
});

test("Initiate arms an existing nextTurnAttack status and the following Attack consumes it once", () => {
  const boards = { self: board({ stage3cStatuses: [delayedAttack] }), opponent: board() };
  const initiated = activateQuickDuelRuntimeStatusesForEvent(boards, "onInitiate", "player", operations);
  assert.equal(initiated.boards.self.nextAttackBonus, 0);
  assert.equal(initiated.boards.self.stage3cStatuses.length, 1);
  assert.equal(initiated.boards.self.stage3cStatuses[0].qualifier?.nextTurnAttackArmed, true);
  assert.deepEqual(initiated.commands, []);

  const attack = activateQuickDuelRuntimeStatusesForEvent(initiated.boards, "onAttackDeclared", "player", operations);
  assert.equal(attack.boards.self.nextAttackBonus, 3);
  assert.equal(attack.boards.self.stage3cStatuses.length, 0);
  assert.deepEqual(attack.commands.map((command) => command.sourceEffectId), ["future-attack-bonus"]);

  const duplicate = activateQuickDuelRuntimeStatusesForEvent(attack.boards, "onAttackDeclared", "player", operations);
  assert.equal(duplicate.boards.self.nextAttackBonus, 3);
  assert.deepEqual(duplicate.commands, []);
});

test("a nextTurnAttack status created after Initiate waits for the following Initiate", () => {
  const empty = { self: board(), opponent: board() };
  const initiated = activateQuickDuelRuntimeStatusesForEvent(empty, "onInitiate", "player", operations);
  const createdAfterInitiate = {
    self: { ...initiated.boards.self, stage3cStatuses: [delayedAttack] },
    opponent: initiated.boards.opponent,
  };

  const sameTurnAttack = activateQuickDuelRuntimeStatusesForEvent(createdAfterInitiate, "onAttackDeclared", "player", operations);
  assert.equal(sameTurnAttack.boards.self.nextAttackBonus, 0);
  assert.equal(sameTurnAttack.boards.self.stage3cStatuses[0].qualifier?.nextTurnAttackArmed, undefined);

  const nextInitiate = activateQuickDuelRuntimeStatusesForEvent(sameTurnAttack.boards, "onInitiate", "player", operations);
  const nextTurnAttack = activateQuickDuelRuntimeStatusesForEvent(nextInitiate.boards, "onAttackDeclared", "player", operations);
  assert.equal(nextTurnAttack.boards.self.nextAttackBonus, 3);
  assert.equal(nextTurnAttack.boards.self.stage3cStatuses.length, 0);
});

test("explicit later-turn fact remains a compatibility escape hatch for non-Initiate hosts", () => {
  const boards = { self: board({ stage3cStatuses: [delayedAttack] }), opponent: board() };
  const nextTurn = activateQuickDuelRuntimeStatusesForEvent(boards, "onAttackDeclared", "player", operations, { nextTurn: true });
  assert.equal(nextTurn.boards.self.nextAttackBonus, 3);
  assert.equal(nextTurn.boards.self.stage3cStatuses.length, 0);
  assert.deepEqual(nextTurn.commands.map((command) => command.sourceEffectId), ["future-attack-bonus"]);
});
