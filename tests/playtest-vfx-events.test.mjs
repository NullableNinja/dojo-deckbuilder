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
    hand: ["a", "b", "c"],
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

function match(overrides = {}) {
  return {
    schema: 8,
    player: board(),
    ai: board(),
    locationId: "loc-a",
    winner: null,
    log: ["older filing"],
    ...overrides,
  };
}

test("real HP loss and healing derive Hit and Heal events", () => {
  const previous = match();
  const damaged = match({ player: board({ hp: 21 }) });
  assert.deepEqual(derivePlaytestEvents(previous, damaged).filter((event) => event.type === "combat.hit"), [
    { type: "combat.hit", actor: "ai", target: "player", amount: 4 },
  ]);

  const healed = match({ player: board({ hp: 24 }) });
  assert.deepEqual(derivePlaytestEvents(damaged, healed).filter((event) => event.type === "vitality.heal"), [
    { type: "vitality.heal", fighter: "player", amount: 3 },
  ]);
});

test("Attack declaration uses actual attack counter and zone history", () => {
  const previous = match();
  const next = match({ player: board({ attacksThisTurn: 1, zonesPlayed: ["Mid"] }) });
  assert.deepEqual(derivePlaytestEvents(previous, next).filter((event) => event.type === "combat.attack"), [
    { type: "combat.attack", actor: "player", target: "ai", zone: "Mid" },
  ]);
});

test("Block event recognizes both Defense-card and standing-DEF combat logs", () => {
  const previous = match();
  const playerBlocks = match({ log: ["High Guard blocks Flying Knee and is discarded. Attack 4 vs Defense 6.", "older filing"] });
  assert.deepEqual(derivePlaytestEvents(previous, playerBlocks).filter((event) => event.type === "combat.block"), [
    { type: "combat.block", actor: "ai", target: "player" },
  ]);

  const aiBlocks = match({ log: ["Basic Jab is blocked by the opponent's standing DEF/Equipment; no Defense card was played. Attack 2 vs Defense 4.", "older filing"] });
  assert.deepEqual(derivePlaytestEvents(previous, aiBlocks).filter((event) => event.type === "combat.block"), [
    { type: "combat.block", actor: "player", target: "ai" },
  ]);
});

test("Focus, XP, Tempo, Flow, Equipment, purchase, promotion, Combo and scene state derive semantic events", () => {
  const previous = match();
  const next = match({
    player: board({
      xp: 3,
      focus: 2,
      focusGeneratedThisTurn: 2,
      focusSpentThisTurn: 1,
      tempo: false,
      nextAttackHasFlow: true,
      flowUsedThisTurn: true,
      exhaustedEquipment: ["gear-a"],
      cardsBought: 1,
      completedTasks: [1],
      completedBeltExamThisRound: true,
      belt: 1,
      triggeredCombos: ["combo-a"],
    }),
    locationId: "loc-b",
  });
  const types = derivePlaytestEvents(previous, next).map((event) => event.type);
  for (const expected of [
    "resource.focusGain",
    "resource.focusSpend",
    "resource.xpGain",
    "tempo.used",
    "flow.ready",
    "flow.triggered",
    "equipment.exhaust",
    "market.purchase",
    "progress.beltExam",
    "progress.promotion",
    "combo.completed",
    "scene.change",
  ]) assert.ok(types.includes(expected), `expected ${expected}`);
});

test("KO is derived only when winner transitions from unset to a fighter", () => {
  const previous = match();
  const next = match({ ai: board({ hp: 0 }), winner: "player" });
  const events = derivePlaytestEvents(previous, next);
  assert.ok(events.some((event) => event.type === "combat.hit" && event.target === "ai" && event.amount === 25));
  assert.deepEqual(events.filter((event) => event.type === "combat.ko"), [
    { type: "combat.ko", fighter: "ai", winner: "player" },
  ]);
});

test("turn cleanup resets do not emit fake spending, attacks, purchases or Combo events", () => {
  const previous = match({
    player: board({
      focusGeneratedThisTurn: 5,
      focusSpentThisTurn: 4,
      attacksThisTurn: 3,
      cardsBought: 2,
      triggeredCombos: ["a"],
      hand: ["a"],
    }),
  });
  const next = match({ player: board({ hand: ["a"] }) });
  const types = derivePlaytestEvents(previous, next).map((event) => event.type);
  assert.equal(types.includes("resource.focusSpend"), false);
  assert.equal(types.includes("combat.attack"), false);
  assert.equal(types.includes("market.purchase"), false);
  assert.equal(types.includes("combo.completed"), false);
});
