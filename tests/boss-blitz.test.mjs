import assert from "node:assert/strict";
import test from "node:test";
import { loadGameData } from "../engine/rules-loader.mjs";
import { BossBlitzGame } from "../engine/boss-blitz.mjs";
import { replayGame, replayMatches } from "../engine/replay.mjs";

test("Boss Blitz is an executable canonical mode with the three-stage ladder", async () => {
  const data = await loadGameData({ modeId: "boss-blitz" });
  assert.equal(data.definition.mode.id, "boss-blitz");
  assert.deepEqual(data.definition.mode.bossBlitz.stageNames, ["Rival", "Mini-Boss", "Final Boss"]);

  const result = new BossBlitzGame(data, { seed: 42 }).run();
  assert.equal(result.mode, "boss-blitz");
  assert.equal(result.scenario.bossStats.stages, 3);
  assert.equal(result.scenario.bossStats.stageTransitions, 2);
  assert.ok(result.telemetry.boss.bossAttacks > 0);
  assert.ok(result.telemetry.boss.arsenalRevealed >= result.telemetry.boss.bossAttacks);
  assert.equal(result.invariantFailures.length, 0);
  assert.equal(result.unsupportedEffects, 0);
  assert.equal(result.state.pendingChoice, null);
});

test("Boss Blitz replay preserves automated Boss-turn choices", async () => {
  const data = await loadGameData({ modeId: "boss-blitz" });
  const original = new BossBlitzGame(data, { seed: 17 }).run();
  const replayed = replayGame(data, original);
  assert.equal(replayMatches(original, replayed), true);
});

test("Boss Blitz exercises Boss Guard, Enrage, and roster replacement across deterministic seeds", async () => {
  const data = await loadGameData({ modeId: "boss-blitz" });
  let guardUses = 0;
  let enrageTurns = 0;
  let completed = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const result = new BossBlitzGame(data, { seed }).run();
    completed += 1;
    guardUses += result.telemetry.boss.guardUses;
    enrageTurns += result.telemetry.boss.enrageTurns;
    assert.equal(result.invariantFailures.length, 0, `seed ${seed} invariant failure`);
    assert.equal(result.unsupportedEffects, 0, `seed ${seed} unsupported effect`);
    assert.equal(result.state.pendingChoice, null, `seed ${seed} retained a pending choice`);
  }
  assert.equal(completed, 12);
  assert.ok(guardUses > 0);
  assert.ok(enrageTurns > 0);
});
