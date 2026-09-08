import assert from "node:assert/strict";
import test from "node:test";
import { applyStage3CBoardCustomCommand, revertStage3CBoardCustomStatus } from "../app/stage3c-board-command-semantics.ts";

const base = () => ({ attackModifier: 0, defenseModifier: 0, speedOverride: null });
test("Quick Duel Board semantics execute structured set-Speed and temporary ATK/DEF custom commands", () => {
  const burrito = applyStage3CBoardCustomCommand(base(), { effect: "core.custom", amount: 1, resolver: "consumable.setSpeedToValue", qualifier: { setValue: 1 } });
  assert.equal(burrito.handled, true);
  assert.equal(burrito.state.speedOverride, 1);
  assert.equal(revertStage3CBoardCustomStatus(burrito.state, { effect: "core.custom", amount: 1, resolver: "consumable.setSpeedToValue", qualifier: { setValue: 1 } }).state.speedOverride, null);

  const shake = applyStage3CBoardCustomCommand(base(), { effect: "core.custom", amount: 3, resolver: "consumable.modifyAttackStat", qualifier: { stat: "ATK" } });
  assert.equal(shake.state.attackModifier, 3);
  assert.equal(revertStage3CBoardCustomStatus(shake.state, { effect: "core.custom", amount: 3, resolver: "consumable.modifyAttackStat", qualifier: { stat: "ATK" } }).state.attackModifier, 0);

  const wine = applyStage3CBoardCustomCommand(base(), { effect: "core.custom", amount: -1, resolver: "consumable.modifyDefenseUntilNextTurn", qualifier: { stat: "DEF" } });
  assert.equal(wine.state.defenseModifier, -1);
  assert.equal(revertStage3CBoardCustomStatus(wine.state, { effect: "core.custom", amount: -1, resolver: "consumable.modifyDefenseUntilNextTurn", qualifier: { stat: "DEF" } }).state.defenseModifier, 0);
});
