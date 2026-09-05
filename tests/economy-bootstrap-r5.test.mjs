import test from "node:test";
import assert from "node:assert/strict";
import { loadGameData } from "../engine/rules-loader.mjs";
import { Game } from "../engine/core.mjs";

test("v2.3-r5 starter economy uses seven-card hands, one Bad Habit cash-in, and 2-Focus Wild Swing", async () => {
  const data = await loadGameData();
  assert.equal(data.definition.rulesRevision, "v2.3-r5");
  assert.equal(data.definition.turn.handSize, 7);
  assert.equal(data.definition.economy.badHabitFocus.usesPerTurn, 1);
  assert.equal(data.definition.economy.badHabitFocus.focusGain, 1);
  assert.equal(data.byId.get("DDB-STA-CORE-011").focusValue, 2);
  const game = new Game(data, { seed: 7 });
  const p = game.players[0];
  assert.equal(p.hand.length, 7);
  const badHabit = data.byId.get("DDB-STA-CORE-001");
  p.hand = [badHabit, badHabit, ...p.hand.filter(c => c.catalogId !== badHabit.catalogId).slice(0, 5)];
  p.focus = 0;
  assert.equal(game.cashBadHabit(p), true);
  assert.equal(p.focus, 1);
  assert.equal(p.badHabitFocusUsed, true);
  assert.equal(p.hand.filter(c => c.catalogId === badHabit.catalogId).length, 1);
  assert.equal(game.cashBadHabit(p), false);
  assert.equal(p.focus, 1);
  game.hide(p);
  assert.equal(p.badHabitFocusUsed, false);
  assert.equal(p.hand.length, 7);
});
