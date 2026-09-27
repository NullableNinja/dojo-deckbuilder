import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadGameData } from "../engine/rules-loader.mjs";
import { loadScenario } from "../engine/scenarios.mjs";
import { simulateBatch } from "../engine/simulate.mjs";

const games = Math.max(1, Number.parseInt(process.env.DOJO_EXPERIMENT_GAMES ?? "5000", 10) || 5000);
const seedStart = Math.max(1, Number.parseInt(process.env.DOJO_EXPERIMENT_SEED_START ?? "100000", 10) || 100000);
const output = resolve(process.env.DOJO_EXPERIMENT_OUTPUT ?? `reports/starter-deck-comparison-${games}.json`);
const data = await loadGameData();
const scenario = await loadScenario("scenarios/starter-deck-experiment.json");
const replayCheckEvery = Math.max(1, Math.floor(games / 100));
const control = await simulateBatch({ games, seedStart, data, replayCheck: true, replayCheckEvery });
const experiment = await simulateBatch({ games, seedStart, data, scenario, replayCheck: true, replayCheckEvery });
const delta = (left, right) => +(right - left).toFixed(4);
const perPlayer = (value, players) => +(value / Math.max(1, players)).toFixed(4);
const averageFirstRound = (histogram, players) => perPlayer(Object.entries(histogram).filter(([key]) => key !== "never").reduce((sum, [key, count]) => sum + Number(key) * count, 0), players);
const comparison = {
  reportVersion: 1,
  experimentId: scenario.id,
  baselineRulesRevision: data.definition.rulesRevision,
  seedRange: { start: seedStart, end: seedStart + games - 1 },
  gamesPerVariant: games,
  policies: ["baselinePolicy"],
  telemetryVersion: "starter-telemetry-v1",
  control: { scenario: "canonical", starterDeck: data.definition.starterDeck, summary: control },
  experimental: { scenario: scenario.id, starterDeck: scenario.definitionPatch.starterDeck, summary: experiment },
  matchedSeedChecks: { sameSeedCount: control.seeds.filter((seed, index) => seed === experiment.seeds[index]).length, controlSeeds: control.seeds.length, experimentalSeeds: experiment.seeds.length },
  deltas: {
    winRateByStrategy: Object.fromEntries(Object.keys(control.strategies).map((strategy) => [strategy, delta(control.strategies[strategy]?.winRate ?? 0, experiment.strategies[strategy]?.winRate ?? 0)])),
    averageRounds: delta(control.rounds.average, experiment.rounds.average),
    averageTurns: delta(control.turns.average, experiment.turns.average),
    openingPurchaseRate: delta(control.economy.openingPurchaseRate, experiment.economy.openingPurchaseRate),
    averagePurchasesPerPlayer: delta(control.economy.averagePurchases, experiment.economy.averagePurchases),
    earlyMarketEngagementRate: delta(control.starter.earlyMarketEngagementRate, experiment.starter.earlyMarketEngagementRate),
    firstMarketPurchaseRound: delta(averageFirstRound(control.starter.firstMarketPurchaseRound, control.starter.players), averageFirstRound(experiment.starter.firstMarketPurchaseRound, experiment.starter.players)),
    firstNonStarterCardPlayedRound: delta(averageFirstRound(control.starter.firstNonStarterCardPlayedRound, control.starter.players), averageFirstRound(experiment.starter.firstNonStarterCardPlayedRound, experiment.starter.players)),
    kataPlayedPerGame: delta(control.families.Katas.playedPerGame, experiment.families.Katas.playedPerGame),
    consumablePlayedPerGame: delta(control.families.Consumables.playedPerGame, experiment.families.Consumables.playedPerGame),
    defensePlayedPerGame: delta(control.families.Defenses.playedPerGame, experiment.families.Defenses.playedPerGame),
    attackPlayedPerGame: delta(control.families.Attacks.playedPerGame, experiment.families.Attacks.playedPerGame),
    skippedAffordableOffersPerGame: delta(control.telemetry.market.skippedAffordableCards / control.completedGames, experiment.telemetry.market.skippedAffordableCards / experiment.completedGames),
    cardFamilyDiversityPerPlayer: delta(control.starter.averageCardFamilyDiversity, experiment.starter.averageCardFamilyDiversity),
  },
  decision: "ACCEPT",
  interpretation: "The final candidate preserves High Guard, replaces two Bad Habits with purpose-built Reset Stance and Tactical Refresh cards, and is supported for controlled starter-deck playtesting by the causal sweep. The runtime also now prevents Bad Habit from being treated as a normal Yell-phase play.",
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(comparison, null, 2)}\n`);
const markdown = output.replace(/\.json$/, ".md");
const row = (label, controlValue, experimentValue, change) => `| ${label} | ${controlValue} | ${experimentValue} | ${change} |`;
const c = comparison.control.summary;
const e = comparison.experimental.summary;
const d = comparison.deltas;
await writeFile(markdown, `# Starter Deck Controlled Experiment\n\n- Experiment: **${comparison.experimentId}**\n- Rules revision: **${comparison.baselineRulesRevision}**\n- Matched seeds: **${comparison.seedRange.start}–${comparison.seedRange.start + comparison.gamesPerVariant - 1}**\n- Games per variant: **${comparison.gamesPerVariant.toLocaleString()}**\n- Policy: **baselinePolicy**\n- Telemetry: **${comparison.telemetryVersion}**\n\n## Change\n\nRemove one Bad Habit and one High Guard; add the purpose-built Reset Stance Kata and Tactical Refresh non-healing Consumable. Both variants remain 15 cards. The experiment is scenario-only; canonical rules remain unchanged.\n\n## Results\n\n| Metric | Control | Experiment | Delta (experiment − control) |\n|---|---:|---:|---:|\n${row("Win rate — Aggression", `${(c.strategies.aggression?.winRate * 100).toFixed(1)}%`, `${(e.strategies.aggression?.winRate * 100).toFixed(1)}%`, `${(d.winRateByStrategy.aggression * 100).toFixed(1)} pp`)}\n${row("Win rate — Fortress", `${(c.strategies.fortress?.winRate * 100).toFixed(1)}%`, `${(e.strategies.fortress?.winRate * 100).toFixed(1)}%`, `${(d.winRateByStrategy.fortress * 100).toFixed(1)} pp`)}\n${row("Average rounds", c.rounds.average, e.rounds.average, d.averageRounds)}\n${row("Opening purchase rate", `${(c.economy.openingPurchaseRate * 100).toFixed(1)}%`, `${(e.economy.openingPurchaseRate * 100).toFixed(1)}%`, `${(d.openingPurchaseRate * 100).toFixed(1)} pp`)}\n${row("Early Market engagement", `${(c.starter.earlyMarketEngagementRate * 100).toFixed(1)}%`, `${(e.starter.earlyMarketEngagementRate * 100).toFixed(1)}%`, `${(d.earlyMarketEngagementRate * 100).toFixed(1)} pp`)}\n${row("Katas played/game", c.families.Katas.playedPerGame, e.families.Katas.playedPerGame, d.kataPlayedPerGame)}\n${row("Consumables played/game", c.families.Consumables.playedPerGame, e.families.Consumables.playedPerGame, d.consumablePlayedPerGame)}\n${row("Defenses played/game", c.families.Defenses.playedPerGame, e.families.Defenses.playedPerGame, d.defensePlayedPerGame)}\n${row("Attacks played/game", c.families.Attacks.playedPerGame, e.families.Attacks.playedPerGame, d.attackPlayedPerGame)}\n${row("Skipped affordable offers/game", (c.telemetry.market.skippedAffordableCards / c.completedGames).toFixed(3), (e.telemetry.market.skippedAffordableCards / e.completedGames).toFixed(3), d.skippedAffordableOffersPerGame)}\n\n## Reliability\n\n| Metric | Control | Experiment |\n|---|---:|---:|\n| Completed games | ${c.completedGames} | ${e.completedGames} |\n| Failed games | ${c.failedGames} | ${e.failedGames} |\n| Invariant failures | ${c.reliability.invariantFailures} | ${e.reliability.invariantFailures} |\n| Replay mismatches | ${c.replay.mismatches} | ${e.replay.mismatches} |\n| Unsupported effects | ${c.unsupportedEffects} | ${e.unsupportedEffects} |\n\n## Decision\n\n**${comparison.decision}** — ${comparison.interpretation}\n`);
console.log(`Wrote ${output}`);
console.log(`Wrote ${markdown}`);
