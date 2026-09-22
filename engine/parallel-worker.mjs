import { parentPort, workerData } from "node:worker_threads";
import { loadGameData } from "./rules-loader.mjs";
import { createGame } from "./games.mjs";
import { baselinePolicy, randomLegalPolicy } from "./policies.mjs";
import { STRATEGIES } from "./bots.mjs";
import { requireExecutableMode } from "./modes.mjs";
import { replayGame, replayMatches, replayDiff } from "./replay.mjs";

const policies = { baseline: baselinePolicy, random: randomLegalPolicy };
const policy = policies[workerData.policy] ?? baselinePolicy;
const data = await loadGameData({ modeId: workerData.mode });
const mode = requireExecutableMode(data, workerData.mode);

function strategiesFor(index) {
  return [STRATEGIES[index % STRATEGIES.length], STRATEGIES[Math.floor(index / STRATEGIES.length) % STRATEGIES.length]];
}

function compactResult(result, seed, index, strategies, replay) {
  const base = {
    ok: true, seed, index, modeId: mode.id, rulesVersion: data.definition.rulesVersion, rulesRevision: data.definition.rulesRevision,
    winner: result.winner, reason: result.reason, rounds: result.rounds, turns: result.turns,
    strategies, mode: result.mode ?? mode.id, scenario: result.scenario ?? null, players: result.players, telemetry: result.telemetry, cards: result.cards,
    invariantFailures: result.invariantFailures, unsupportedEffects: result.unsupportedEffects,
    replay, state: result.state,
  };
  if (workerData.detail === "full") { base.decisions = result.decisions; base.events = result.events; }
  return base;
}

for (let index = workerData.workerId; index < workerData.games; index += workerData.workerCount) {
  const seed = workerData.seedStart + index;
  const strategies = strategiesFor(index);
  let game;
  try {
    game = createGame(data, { seed, strategies });
    const result = game.run({ policy });
    let replay = null;
    if (workerData.replayEvery > 0 && (index === 0 || index % workerData.replayEvery === 0)) {
      const replayed = replayGame(data, result);
      replay = { checked: true, matches: replayMatches(result, replayed), differences: replayMatches(result, replayed) ? [] : replayDiff(result, replayed) };
    }
    parentPort.postMessage({ type: "game", result: compactResult(result, seed, index, strategies, replay) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const invariantFailures = game?.invariantFailure?.failures ?? game?.checkInvariants?.() ?? [];
    const failure = {
      ok: false, seed, index, modeId: mode.id, rulesVersion: data.definition.rulesVersion, rulesRevision: data.definition.rulesRevision,
      strategies, message, invariantFailures, state: game?.invariantFailure?.state ?? game?.getState?.() ?? null,
      decisions: game?.invariantFailure?.decisions ?? game?.decisions ?? [], events: game?.invariantFailure?.events ?? game?.events ?? [],
    };
    parentPort.postMessage({ type: "game", result: failure });
  }
}
parentPort.postMessage({ type: "complete", workerId: workerData.workerId });
