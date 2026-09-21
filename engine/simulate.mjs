import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadGameData } from "./rules-loader.mjs";
import { Game } from "./core.mjs";
import { baselinePolicy } from "./policies.mjs";
import { STRATEGIES } from "./bots.mjs";

const integer = (value, fallback) => Math.max(1, Number.parseInt(String(value ?? fallback), 10) || fallback);

export async function simulateBatch({ games = 1000, seedStart = 1, output = null, data = null, policy = baselinePolicy } = {}) {
  const count = integer(games, 1000);
  const gameData = data ?? await loadGameData();
  const baseline = { ...gameData, definition: structuredClone(gameData.definition) };
  baseline.definition.economy.defensePractice.usesPerTurn = 0;
  const summary = {
    rulesVersion: gameData.definition.rulesVersion, seedStart, games: count, successfulGames: 0, failedGames: 0,
    seeds: [], failures: [], invariantFailures: [], unsupportedEffects: 0, strategies: {}, matchups: {},
    rounds: { sum: 0, average: 0, min: Infinity, max: 0, roundLimitGames: 0 }, turns: { sum: 0, average: 0 },
    telemetry: { attacks: 0, hits: 0, blocks: 0, totalDamage: 0, damagePrevented: 0, cardsPlayed: 0, cardsAcquired: 0, focusGenerated: 0, focusSpent: 0, defensePractice: 0 },
    economy: { openingPurchasePlayers: 0, openingPurchaseRate: 0, turnOneParalysisPlayers: 0, withoutDefensePracticeOpeningPurchasePlayers: 0, withoutDefensePracticeOpeningPurchaseRate: 0, defensePracticeLift: 0, averagePurchases: 0, totalPurchases: 0 },
    cards: {},
  };

  for (let index = 0; index < count; index += 1) {
    const seed = seedStart + index;
    const firstStrategy = STRATEGIES[index % STRATEGIES.length];
    const secondStrategy = STRATEGIES[Math.floor(index / STRATEGIES.length) % STRATEGIES.length];
    const strategies = [firstStrategy, secondStrategy];
    let result;
    try {
      result = new Game(gameData, { seed, strategies }).run({ policy });
    } catch (error) {
      summary.failedGames += 1;
      summary.failures.push({ game: index + 1, seed, message: error instanceof Error ? error.message : String(error) });
      continue;
    }
    summary.successfulGames += 1;
    summary.seeds.push(seed);
    if (result.invariantFailures.length) summary.invariantFailures.push({ game: index + 1, seed, failures: result.invariantFailures });
    summary.unsupportedEffects += result.unsupportedEffects;
    const baselineResult = new Game(baseline, { seed, strategies }).run({ policy });
    summary.economy.withoutDefensePracticeOpeningPurchasePlayers += baselineResult.players.filter((player) => player.openingPurchase).length;
    const matchupKey = `${firstStrategy} vs ${secondStrategy}`;
    const matchup = (summary.matchups[matchupKey] ??= { games: 0, wins: {} }); matchup.games += 1;
    if (result.winner !== null) { const winningStrategy = result.players[result.winner].strategy; matchup.wins[winningStrategy] = (matchup.wins[winningStrategy] ?? 0) + 1; }
    for (const player of result.players) {
      const strategy = (summary.strategies[player.strategy] ??= { games: 0, wins: 0, winRate: 0 }); strategy.games += 1;
      if (player.id === result.winner) strategy.wins += 1;
      summary.economy.totalPurchases += player.purchases;
      if (player.openingPurchase) summary.economy.openingPurchasePlayers += 1; else summary.economy.turnOneParalysisPlayers += 1;
    }
    summary.rounds.sum += result.rounds; summary.rounds.min = Math.min(summary.rounds.min, result.rounds); summary.rounds.max = Math.max(summary.rounds.max, result.rounds); if (result.reason === "round-limit") summary.rounds.roundLimitGames += 1;
    summary.turns.sum += result.turns;
    for (const [key, value] of Object.entries(result.telemetry)) if (key in summary.telemetry) summary.telemetry[key] += value;
    for (const card of result.cards) { const cardSummary = (summary.cards[card.id] ??= { name: card.name, offered: 0, drawn: 0, purchased: 0, played: 0, winnerGames: 0 }); for (const key of ["offered", "drawn", "purchased", "played", "winnerOwned"]) cardSummary[key === "winnerOwned" ? "winnerGames" : key] += card[key] ?? 0; }
  }

  const successful = summary.successfulGames || 1;
  for (const strategy of Object.values(summary.strategies)) strategy.winRate = +(strategy.wins / strategy.games).toFixed(4);
  summary.rounds.average = +(summary.rounds.sum / successful).toFixed(2); summary.turns.average = +(summary.turns.sum / successful).toFixed(2);
  summary.economy.openingPurchaseRate = +(summary.economy.openingPurchasePlayers / (successful * 2)).toFixed(4); summary.economy.withoutDefensePracticeOpeningPurchaseRate = +(summary.economy.withoutDefensePracticeOpeningPurchasePlayers / (successful * 2)).toFixed(4); summary.economy.defensePracticeLift = +(summary.economy.openingPurchaseRate - summary.economy.withoutDefensePracticeOpeningPurchaseRate).toFixed(4); summary.economy.averagePurchases = +(summary.economy.totalPurchases / (successful * 2)).toFixed(2);
  for (const card of Object.values(summary.cards)) { card.playRate = +(card.played / (successful * 2)).toFixed(4); card.purchaseRate = +(card.purchased / (successful * 2)).toFixed(4); card.winCorrelation = card.purchased ? +(card.winnerGames / card.purchased).toFixed(4) : 0; }
  if (output) await writeSimulationReport(summary, output);
  return summary;
}

export async function writeSimulationReport(summary, output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
  const markdown = output.replace(/\.json$/, ".md");
  const strategyRows = Object.entries(summary.strategies).map(([name, strategy]) => `| ${name} | ${strategy.games} | ${strategy.wins} | ${(strategy.winRate * 100).toFixed(1)}% |`).join("\n");
  await writeFile(markdown, `# Dojo Deckbuilder ${summary.rulesVersion} Simulation\n\n${summary.successfulGames.toLocaleString()} deterministic headless games (${summary.failedGames} failures). Seeds begin at ${summary.seedStart}.\n\n| Metric | Result |\n|---|---:|\n| Average rounds | ${summary.rounds.average} |\n| Round-limit games | ${summary.rounds.roundLimitGames} |\n| Opening purchase rate | ${(summary.economy.openingPurchaseRate * 100).toFixed(1)}% |\n| Average purchases per player | ${summary.economy.averagePurchases} |\n| Unsupported effect events | ${summary.unsupportedEffects} |\n| Invariant failure records | ${summary.invariantFailures.length} |\n\n## Strategy results\n\n| Strategy | Seats | Wins | Win rate |\n|---|---:|---:|---:|\n${strategyRows}\n\nThe JSON includes seeds, failures, invariant records, event telemetry, and per-card offered/drawn/purchased/played statistics.\n`);
}

function parseArgs(args) {
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  return { games: integer(positional[0], 1000), output: positional[1] ?? option("out", `reports/simulation-current.json`), seedStart: integer(option("seed", 1), 1) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await simulateBatch(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({ games: result.games, successfulGames: result.successfulGames, failedGames: result.failedGames, rulesVersion: result.rulesVersion, seedStart: result.seedStart, averageRounds: result.rounds.average, unsupportedEffects: result.unsupportedEffects, invariantFailures: result.invariantFailures.length, output: parseArgs(process.argv.slice(2)).output }, null, 2));
}
