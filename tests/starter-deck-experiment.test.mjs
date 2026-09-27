import test from "node:test";
import assert from "node:assert/strict";
import { loadGameData } from "../engine/rules-loader.mjs";
import { applyScenario, loadScenario } from "../engine/scenarios.mjs";
import { Game } from "../engine/core.mjs";
import { baselinePolicy } from "../engine/policies.mjs";

test("starter experiment is an isolated 15-card scenario with matched canonical execution", async () => {
  const data = await loadGameData();
  const scenario = await loadScenario("scenarios/starter-deck-experiment.json");
  const variant = applyScenario(data, scenario);
  const starterCount = variant.definition.starterDeck.reduce((sum, entry) => sum + entry.copies, 0);
  assert.equal(starterCount, 15);
  assert.equal(variant.definition.starterDeck.find((entry) => entry.catalogId === "DDB-STA-CORE-001").copies, 4);
  assert.equal(variant.definition.starterDeck.some((entry) => entry.catalogId === "DDB-STA-CORE-009"), false);
  assert.equal(variant.definition.starterDeck.find((entry) => entry.catalogId === "DDB-STA-EXP-001").copies, 1);
  assert.equal(variant.definition.starterDeck.find((entry) => entry.catalogId === "DDB-STA-EXP-002").copies, 1);
  assert.equal(variant.byId.get("DDB-STA-EXP-001").subtype, "Kata");
  assert.equal(variant.byId.get("DDB-STA-EXP-002").subtype, "Consumable");

  const game = new Game(variant, { seed: 424242, strategies: ["balanced", "balanced"] });
  const player = game.players[0];
  game.phase = "Yell";
  game.activePlayer = 0;
  const resetStance = game.cardInstance(variant.byId.get("DDB-STA-EXP-001"));
  player.hand.push(resetStance);
  assert.equal(game.playCard(player, resetStance), true);
  if (game.pendingChoice) assert.equal(game.resolveChoice({ optionId: game.pendingChoice.options[0].id }), true);
  const tacticalRefresh = game.cardInstance(variant.byId.get("DDB-STA-EXP-002"));
  player.hand.push(tacticalRefresh);
  assert.equal(game.playCard(player, tacticalRefresh), true);
  assert.equal(player.destroyed.some((card) => card.catalogId === "DDB-STA-EXP-002"), true);
  const result = game.run({ policy: baselinePolicy });
  assert.equal(result.invariantFailures.length, 0);
  assert.equal(result.unsupportedEffects, 0);
  assert.equal(result.telemetry.market.opportunities > 0, true);
  assert.equal(result.telemetry.unsupportedEffects, 0);
  assert.equal(result.players.every((player) => player.firstMarketPurchaseRound === null || player.firstMarketPurchaseRound >= 1), true);
});

test("canonical starter deck is unchanged by the experiment overlay", async () => {
  const data = await loadGameData();
  const scenario = await loadScenario("scenarios/starter-deck-experiment.json");
  const variant = applyScenario(data, scenario);
  assert.notDeepEqual(variant.definition.starterDeck, data.definition.starterDeck);
  assert.equal(data.definition.starterDeck.reduce((sum, entry) => sum + entry.copies, 0), 15);
  assert.equal(data.definition.starterDeck.find((entry) => entry.catalogId === "DDB-STA-CORE-001").copies, 5);
  assert.equal(data.definition.starterDeck.find((entry) => entry.catalogId === "DDB-STA-CORE-009").copies, 1);
  assert.equal(data.byId.has("DDB-STA-EXP-001"), false);
  assert.equal(data.byId.has("DDB-STA-EXP-002"), false);
});
