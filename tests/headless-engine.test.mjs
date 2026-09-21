import assert from "node:assert/strict";
import test from "node:test";
import { loadGameData } from "../engine/rules-loader.mjs";
import { Game } from "../engine/core.mjs";
import { simulateBatch } from "../engine/simulate.mjs";

test("headless engine exposes canonical phases, legal actions, and serializable state", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 101 });
  assert.equal(game.phase, "Honor");
  assert.deepEqual(game.getLegalActions(0), [{ type: "pass", playerId: 0 }]);
  game.advanceAutomaticEvents();
  assert.equal(game.phase, "Initiate");
  assert.ok(game.getLegalActions(game.activePlayer).some((action) => action.type === "pass"));
  assert.doesNotThrow(() => JSON.stringify(game.getState()));
});

test("attack and defense choices suspend and resume through one action contract", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 102 });
  game.advanceAutomaticEvents();
  game.applyAction({ type: "pass", playerId: game.activePlayer });
  const attacker = game.activePlayer;
  const attack = game.players[attacker].hand.find((card) => Number(card.stats?.["Attack Power"]) > 0);
  assert.ok(attack);
  assert.equal(game.applyAction({ type: "play-attack", playerId: attacker, cardId: attack.instanceId }), true);
  if (game.getPendingChoice()?.kind === "attack-zone") {
    assert.equal(game.applyAction({ type: "resolve-choice", choice: { optionId: "Mid" } }), true);
  }
  assert.equal(game.getPendingChoice()?.kind, "defense");
  assert.equal(game.applyAction({ type: "resolve-choice", playerId: game.getPendingChoice().playerId, choice: { optionId: "pass" } }), true);
  assert.equal(game.getPendingChoice(), null);
  assert.equal(game.events.filter((event) => event.type === "attack").length, 1);
});

test("supported starter effects execute from the canonical card-effect registry", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 103 });
  game.advanceAutomaticEvents();
  game.applyAction({ type: "pass", playerId: game.activePlayer });
  const player = game.players[game.activePlayer];
  const breathing = game.cardInstance(data.byId.get("DDB-STA-CORE-005"));
  player.hand.push(breathing);
  assert.equal(game.applyAction({ type: "play-card", playerId: player.id, cardId: breathing.instanceId }), true);
  assert.equal(player.nextAttackPower, 1);
  assert.equal(game.telemetry.unsupportedEffects, 0);
});

test("batch simulation reports reproducible seeds and invariant results", async () => {
  const data = await loadGameData();
  const first = await simulateBatch({ games: 4, seedStart: 700, data });
  const second = await simulateBatch({ games: 4, seedStart: 700, data });
  assert.equal(first.successfulGames, 4);
  assert.equal(first.failedGames, 0);
  assert.deepEqual(first.seeds, [700, 701, 702, 703]);
  assert.equal(first.invariantFailures.length, 0);
  assert.deepEqual(first.telemetry, second.telemetry);
  assert.equal(first.unsupportedEffects, second.unsupportedEffects);
});
