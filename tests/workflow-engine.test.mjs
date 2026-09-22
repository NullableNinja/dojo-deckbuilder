import test from "node:test";
import assert from "node:assert/strict";
import { loadGameData } from "../engine/rules-loader.mjs";
import { Game } from "../engine/core.mjs";
import { baselinePolicy } from "../engine/policies.mjs";
import { replayGame, replayMatches } from "../engine/replay.mjs";
import { applyScenario } from "../engine/scenarios.mjs";

test("headless result is replayable with identical telemetry and state", async () => {
  const data = await loadGameData();
  const result = new Game(data, { seed: 4411, strategies: ["balanced", "aggressive"] }).run({ policy: baselinePolicy });
  const replay = replayGame(data, result);
  assert.equal(replayMatches(result, replay), true);
  assert.ok(result.decisions.length > 0);
  assert.equal(result.invariantFailures.length, 0);
  assert.ok(result.telemetry.cardsDrawn > 0);
  assert.ok(result.telemetry.effectApplications > 0);
  assert.equal(result.telemetry.choicesPresented, result.telemetry.choicesResolved);
});

test("scenario overlays are isolated and executable", async () => {
  const data = await loadGameData();
  const scenarioData = applyScenario(data, {
    id: "test-overlay",
    baseRulesVersion: data.definition.rulesVersion,
    definitionPatch: { mode: { maxRounds: 3 } },
  });
  assert.equal(data.definition.mode.maxRounds, 40);
  assert.equal(scenarioData.definition.mode.maxRounds, 3);
  const result = new Game(scenarioData, { seed: 9 }).run({ policy: baselinePolicy });
  assert.equal(result.invariantFailures.length, 0);
});

test("invariants reject negative HP and cross-zone duplicate cards", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 12 });
  game.players[0].hp = -1;
  assert.match(game.checkInvariants().join("\n"), /negative HP/);
  game.players[0].hp = game.players[0].maxHp;
  const card = game.players[0].hand[0];
  game.market.push(card);
  assert.match(game.checkInvariants().join("\n"), /duplicates/);
});
