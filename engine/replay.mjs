import { createGame } from "./games.mjs";

/**
 * A replay policy feeds the exact action/choice decisions recorded by Game.run
 * back into the same headless engine. RNG is still seeded from the original
 * game, so a mismatch is evidence that execution is not deterministic or that
 * a rule path consumed state differently.
 */
export function replayPolicy(decisions = []) {
  let cursor = 0;
  const next = (kind) => {
    const decision = decisions[cursor++];
    if (!decision || decision.kind !== kind) throw new Error(`Replay expected ${kind} decision at index ${cursor - 1}`);
    return kind === "choice" ? decision.choice : decision.action;
  };
  return {
    chooseAction: () => next("action"),
    chooseChoice: () => next("choice"),
  };
}

const comparable = (result) => ({
  seed: result.seed,
  winner: result.winner,
  reason: result.reason,
  rounds: result.rounds,
  turns: result.turns,
  players: result.players,
  cards: result.cards,
  telemetry: result.telemetry,
  invariantFailures: result.invariantFailures,
  unsupportedEffects: result.unsupportedEffects,
  state: result.state,
});

export function replayGame(data, original, { maxSteps = 100000 } = {}) {
  const strategies = (original.players ?? []).map((player) => player.strategy ?? "balanced");
  const game = createGame(data, { seed: original.seed, strategies });
  return game.run({ policy: replayPolicy(original.decisions ?? []), maxSteps });
}

export function replayMatches(original, replayed) {
  return JSON.stringify(comparable(original)) === JSON.stringify(comparable(replayed));
}

export function replayDiff(original, replayed) {
  if (replayMatches(original, replayed)) return [];
  const differences = [];
  for (const key of Object.keys(comparable(original))) {
    if (JSON.stringify(original[key]) !== JSON.stringify(replayed[key])) differences.push(key);
  }
  return differences;
}
