import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadGameData } from "./rules-loader.mjs";
import { Game } from "./core.mjs";
import { STRATEGIES } from "./bots.mjs";

const count = Math.max(1, Number.parseInt(process.argv[2] ?? "1000", 10));
const data = await loadGameData();
const rulesVersion = String(data.definition.rulesVersion ?? "current").replace(/[^A-Za-z0-9._-]+/g, "-");
const output = process.argv[3] ?? `reports/simulation-${rulesVersion}.json`;

const baseline = { ...data, definition: structuredClone(data.definition) };
baseline.definition.economy.defensePractice.usesPerTurn = 0;

const summary = {
  rulesVersion: data.definition.rulesVersion,
  games: count,
  generatedAt: new Date().toISOString(),
  strategies: {},
  matchups: {},
  rounds: { sum: 0, average: 0, min: Infinity, max: 0, roundLimitGames: 0 },
  turns: { sum: 0, average: 0 },
  economy: {
    openingPurchasePlayers: 0,
    openingPurchaseRate: 0,
    turnOneParalysisPlayers: 0,
    withoutDefensePracticeOpeningPurchasePlayers: 0,
    withoutDefensePracticeOpeningPurchaseRate: 0,
    defensePracticeLift: 0,
    averagePurchases: 0,
    totalPurchases: 0,
  },
  cards: {},
};

for (let index = 0; index < count; index += 1) {
  const firstStrategy = STRATEGIES[index % STRATEGIES.length];
  const secondStrategy = STRATEGIES[Math.floor(index / STRATEGIES.length) % STRATEGIES.length];
  const result = new Game(data, { seed: index + 1, strategies: [firstStrategy, secondStrategy] }).run();
  const baselineResult = new Game(baseline, { seed: index + 1, strategies: [firstStrategy, secondStrategy] }).run();

  summary.economy.withoutDefensePracticeOpeningPurchasePlayers += baselineResult.players.filter((player) => player.openingPurchase).length;
  const winningStrategy = result.players[result.winner].strategy;
  const matchupKey = `${firstStrategy} vs ${secondStrategy}`;
  const matchup = (summary.matchups[matchupKey] ??= { games: 0, wins: {} });
  matchup.games += 1;
  matchup.wins[winningStrategy] = (matchup.wins[winningStrategy] ?? 0) + 1;

  for (const player of result.players) {
    const strategy = (summary.strategies[player.strategy] ??= { games: 0, wins: 0, winRate: 0 });
    strategy.games += 1;
    if (player.id === result.winner) strategy.wins += 1;
    summary.economy.totalPurchases += player.purchases;
    if (player.openingPurchase) summary.economy.openingPurchasePlayers += 1;
    else summary.economy.turnOneParalysisPlayers += 1;
  }

  summary.rounds.sum += result.rounds;
  summary.rounds.min = Math.min(summary.rounds.min, result.rounds);
  summary.rounds.max = Math.max(summary.rounds.max, result.rounds);
  if (result.reason === "round-limit") summary.rounds.roundLimitGames += 1;
  summary.turns.sum += result.turns;

  for (const card of result.cards) {
    const cardSummary = (summary.cards[card.id] ??= { name: card.name, purchased: 0, played: 0, winnerGames: 0 });
    cardSummary.purchased += card.purchased;
    cardSummary.played += card.played;
    cardSummary.winnerGames += card.winnerOwned;
  }
}

for (const strategy of Object.values(summary.strategies)) strategy.winRate = +(strategy.wins / strategy.games).toFixed(4);
summary.rounds.average = +(summary.rounds.sum / count).toFixed(2);
summary.turns.average = +(summary.turns.sum / count).toFixed(2);
summary.economy.openingPurchaseRate = +(summary.economy.openingPurchasePlayers / (count * 2)).toFixed(4);
summary.economy.withoutDefensePracticeOpeningPurchaseRate = +(summary.economy.withoutDefensePracticeOpeningPurchasePlayers / (count * 2)).toFixed(4);
summary.economy.defensePracticeLift = +(summary.economy.openingPurchaseRate - summary.economy.withoutDefensePracticeOpeningPurchaseRate).toFixed(4);
summary.economy.averagePurchases = +(summary.economy.totalPurchases / (count * 2)).toFixed(2);
for (const card of Object.values(summary.cards)) {
  card.playRate = +(card.played / count).toFixed(4);
  card.purchaseRate = +(card.purchased / count).toFixed(4);
  card.winCorrelation = card.purchased ? +(card.winnerGames / card.purchased).toFixed(4) : 0;
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
const markdown = output.replace(/\.json$/, ".md");
const strategyRows = Object.entries(summary.strategies)
  .map(([name, strategy]) => `| ${name} | ${strategy.games} | ${strategy.wins} | ${(strategy.winRate * 100).toFixed(1)}% |`)
  .join("\n");
await writeFile(markdown, `# Dojo Deckbuilder ${data.definition.rulesVersion} Simulation

${count.toLocaleString()} deterministic Quick Duel bot games.

| Metric | Result |
|---|---:|
| Average rounds | ${summary.rounds.average} |
| Round-limit games | ${summary.rounds.roundLimitGames} |
| Opening purchase rate | ${(summary.economy.openingPurchaseRate * 100).toFixed(1)}% |
| Without Defense Practice | ${(summary.economy.withoutDefensePracticeOpeningPurchaseRate * 100).toFixed(1)}% |
| Defense Practice lift | ${(summary.economy.defensePracticeLift * 100).toFixed(1)} points |
| Average purchases per player | ${summary.economy.averagePurchases} |

## Strategy results

| Strategy | Seats | Wins | Win rate |
|---|---:|---:|---:|
${strategyRows}

The JSON file contains matchup splits and per-card play, purchase, and winner-association statistics.
`);

console.log(JSON.stringify({
  games: count,
  rulesVersion: data.definition.rulesVersion,
  averageRounds: summary.rounds.average,
  roundLimitGames: summary.rounds.roundLimitGames,
  openingPurchaseRate: summary.economy.openingPurchaseRate,
  withoutDefensePractice: summary.economy.withoutDefensePracticeOpeningPurchaseRate,
  defensePracticeLift: summary.economy.defensePracticeLift,
  output,
  markdown,
}, null, 2));
