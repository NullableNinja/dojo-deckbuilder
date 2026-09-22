import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadGameData } from "./rules-loader.mjs";
import { CARD_FAMILIES, Game } from "./core.mjs";
import { baselinePolicy } from "./policies.mjs";
import { STRATEGIES } from "./bots.mjs";
import { applyScenario, loadScenario, scenarioSummary } from "./scenarios.mjs";
import { replayGame, replayMatches, replayDiff } from "./replay.mjs";

const integer = (value, fallback) => Math.max(1, Number.parseInt(String(value ?? fallback), 10) || fallback);
const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index); const upper = Math.ceil(index);
  return +(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)).toFixed(2);
};
const CARD_KEYS = ["offered", "drawn", "purchased", "played", "discarded", "destroyed", "hits", "blocks", "damageDealt", "damagePrevented", "effectApplications", "equipmentReadied", "equipmentExhausted", "learned", "activated"];
const emptyFamily = () => Object.fromEntries(CARD_KEYS.map((key) => [key, 0]));
const familyMetrics = () => Object.fromEntries(CARD_FAMILIES.map((family) => [family, emptyFamily()]));
const addNumbers = (target, source) => { for (const [key, value] of Object.entries(source ?? {})) if (typeof value === "number") target[key] = (target[key] ?? 0) + value; };

export async function simulateBatch({ games = 1000, seedStart = 1, output = null, data = null, policy = baselinePolicy, scenario = null, replayCheck = true, replayCheckEvery = 100 } = {}) {
  const count = integer(games, 1000);
  const loadedData = data ?? await loadGameData();
  const gameData = scenario ? applyScenario(loadedData, scenario) : loadedData;
  const summary = {
    reportVersion: 2, rulesVersion: gameData.definition.rulesVersion, seedStart, games: count, gamesAttempted: count, successfulGames: 0, completedGames: 0, failedGames: 0,
    seeds: [], failures: [], invariantFailures: [], unsupportedEffects: 0, strategies: {}, matchups: {},
    rounds: { sum: 0, average: 0, min: Infinity, max: 0, roundLimitGames: 0 }, turns: { sum: 0, average: 0 },
    telemetry: { attacks: 0, hits: 0, blocks: 0, totalDamage: 0, damagePrevented: 0, cardsPlayed: 0, cardsAcquired: 0, cardsDrawn: 0, cardsDiscarded: 0, cardsDestroyed: 0, cardsRevealed: 0, equipmentReadied: 0, equipmentExhausted: 0, focusGenerated: 0, focusSpent: 0, xpGenerated: 0, defensePractice: 0, promotions: 0, comboOpportunities: 0, comboAcquisitions: 0, comboActivations: 0, comboEffectsResolved: 0, effectApplications: 0, choicesPresented: 0, choicesResolved: 0, lifecycleEvents: 0, unsupportedEffects: 0, families: familyMetrics() },
    economy: { openingPurchasePlayers: 0, openingPurchaseRate: 0, turnOneParalysisPlayers: 0, averagePurchases: 0, totalPurchases: 0 },
    progression: { averageXpPerPlayer: 0, promotions: 0, comboOwners: 0, comboUsers: 0, comboUses: 0, promotionByTransition: {}, beltDistribution: {}, maxXp: 0 },
    cards: {}, families: {}, outliers: {}, pathological: {}, gameLengths: [], scenario: scenario ? scenarioSummary(scenario) : null,
    replay: { checked: 0, mismatches: 0, differences: [], sampledSeeds: [] },
    reliability: { unsupportedEffectEvents: 0, unresolvedChoices: 0, illegalActions: 0, stalls: 0, invariantFailures: 0, replayMismatches: 0 },
  };
  const roundValues = []; const turnValues = []; const gameSummaries = [];

  for (let index = 0; index < count; index += 1) {
    const seed = seedStart + index;
    const firstStrategy = STRATEGIES[index % STRATEGIES.length];
    const secondStrategy = STRATEGIES[Math.floor(index / STRATEGIES.length) % STRATEGIES.length];
    const strategies = [firstStrategy, secondStrategy];
    let result; let game;
    try {
      game = new Game(gameData, { seed, strategies });
      result = game.run({ policy });
    } catch (error) {
      summary.failedGames += 1;
      const message = error instanceof Error ? error.message : String(error);
      const invariantFailures = game?.invariantFailure?.failures ?? game?.checkInvariants?.() ?? [];
      if (invariantFailures.length) { summary.reliability.invariantFailures += 1; summary.invariantFailures.push({ game: index + 1, seed, strategies, failures: invariantFailures, state: game?.invariantFailure?.state ?? game?.getState?.() ?? null, decisions: game?.invariantFailure?.decisions ?? game?.decisions ?? [], events: game?.invariantFailure?.events ?? game?.events ?? [] }); }
      if (/No legal actions|illegal action|illegal choice/.test(message)) summary.reliability.illegalActions += 1;
      if (/exceeded/.test(message)) summary.reliability.stalls += 1;
      summary.failures.push({ game: index + 1, seed, strategies, message, invariantFailures, state: game?.getState?.() ?? null, decisions: game?.decisions ?? [], events: game?.events ?? [] });
      continue;
    }
    summary.successfulGames += 1; summary.completedGames += 1; summary.seeds.push(seed);
    summary.unsupportedEffects += result.unsupportedEffects;
    if (result.invariantFailures.length) { summary.invariantFailures.push({ game: index + 1, seed, strategies, failures: result.invariantFailures, state: result.state, decisions: result.decisions, events: result.events }); }
    if (result.state?.pendingChoice) summary.reliability.unresolvedChoices += 1;
    if (replayCheck && (summary.replay.checked === 0 || index % Math.max(1, replayCheckEvery) === 0)) {
      summary.replay.checked += 1; summary.replay.sampledSeeds.push(seed);
      const replayed = replayGame(gameData, result);
      if (!replayMatches(result, replayed)) { summary.replay.mismatches += 1; summary.replay.differences.push({ seed, differences: replayDiff(result, replayed) }); summary.reliability.replayMismatches += 1; }
    }
    const matchupKey = `${firstStrategy} vs ${secondStrategy}`;
    const matchup = (summary.matchups[matchupKey] ??= { games: 0, wins: {} }); matchup.games += 1;
    if (result.winner !== null) { const winningStrategy = result.players[result.winner].strategy; matchup.wins[winningStrategy] = (matchup.wins[winningStrategy] ?? 0) + 1; }
    for (const player of result.players) {
      const strategy = (summary.strategies[player.strategy] ??= { games: 0, wins: 0, winRate: 0 }); strategy.games += 1;
      if (player.id === result.winner) strategy.wins += 1;
      summary.economy.totalPurchases += player.purchases;
      if (player.openingPurchase) summary.economy.openingPurchasePlayers += 1; else summary.economy.turnOneParalysisPlayers += 1;
      if (player.learnedCombos?.length) summary.progression.comboOwners += 1;
      if (player.comboTriggered) summary.progression.comboUsers += 1;
      for (const promotion of player.promotionHistory ?? []) {
        const transition = `${gameData.definition.progression.belts[promotion.from]?.name ?? promotion.from}->${gameData.definition.progression.belts[promotion.to]?.name ?? promotion.to}`;
        summary.progression.promotionByTransition[transition] = (summary.progression.promotionByTransition[transition] ?? 0) + 1;
      }
    }
    summary.rounds.sum += result.rounds; summary.rounds.min = Math.min(summary.rounds.min, result.rounds); summary.rounds.max = Math.max(summary.rounds.max, result.rounds); if (result.reason === "round-limit") summary.rounds.roundLimitGames += 1;
    summary.turns.sum += result.turns; roundValues.push(result.rounds); turnValues.push(result.turns);
    for (const [key, value] of Object.entries(result.telemetry)) { if (key === "families") { for (const [family, familyStats] of Object.entries(value)) addNumbers(summary.telemetry.families[family] ??= {}, familyStats); } else if (key in summary.telemetry && typeof value === "number") summary.telemetry[key] += value; }
    summary.progression.comboUses += result.telemetry.comboActivations ?? 0;
    for (const card of result.cards) { const cardSummary = (summary.cards[card.id] ??= { id: card.id, name: card.name, family: card.family ?? "Other", ...Object.fromEntries([...CARD_KEYS, "winnerGames"].map((key) => [key, 0])) }); for (const key of [...CARD_KEYS, "winnerOwned"]) cardSummary[key === "winnerOwned" ? "winnerGames" : key] += card[key] ?? 0; }
    const playerXp = result.players.map((player) => player.xp); summary.progression.maxXp = Math.max(summary.progression.maxXp, ...playerXp); summary.progression.averageXpPerPlayer += playerXp.reduce((sum, value) => sum + value, 0); for (const player of result.players) { const belt = gameData.definition.progression.belts[player.beltIndex]?.name ?? `index-${player.beltIndex}`; summary.progression.beltDistribution[belt] = (summary.progression.beltDistribution[belt] ?? 0) + 1; }
    gameSummaries.push({ seed, winner: result.winner, reason: result.reason, rounds: result.rounds, turns: result.turns, finalHp: result.players.map((player) => player.hp), strategies });
  }

  const successful = summary.successfulGames || 1;
  for (const strategy of Object.values(summary.strategies)) strategy.winRate = +(strategy.wins / strategy.games).toFixed(4);
  summary.rounds.average = +(summary.rounds.sum / successful).toFixed(2); summary.turns.average = +(summary.turns.sum / successful).toFixed(2);
  summary.rounds.percentiles = { p50: percentile(roundValues, 0.5), p90: percentile(roundValues, 0.9), p95: percentile(roundValues, 0.95), p99: percentile(roundValues, 0.99) }; summary.turns.percentiles = { p50: percentile(turnValues, 0.5), p90: percentile(turnValues, 0.9), p95: percentile(turnValues, 0.95), p99: percentile(turnValues, 0.99) };
  summary.economy.openingPurchaseRate = +(summary.economy.openingPurchasePlayers / (successful * 2)).toFixed(4); summary.economy.averagePurchases = +(summary.economy.totalPurchases / (successful * 2)).toFixed(2); summary.progression.averageXpPerPlayer = +(summary.progression.averageXpPerPlayer / (successful * 2)).toFixed(2); summary.reliability.unsupportedEffectEvents = summary.unsupportedEffects;
  for (const [family, raw] of Object.entries(summary.telemetry.families)) { summary.families[family] = { ...raw, offeredPerGame: +(raw.offered / successful).toFixed(3), purchasedPerGame: +(raw.purchased / successful).toFixed(3), purchaseRateWhenOffered: raw.offered ? +(raw.purchased / raw.offered).toFixed(4) : 0, drawnPerGame: +(raw.drawn / successful).toFixed(3), playedPerGame: +(raw.played / successful).toFixed(3), effectApplicationsPerPlay: raw.played ? +(raw.effectApplications / raw.played).toFixed(4) : 0, unusedDiscardRate: raw.drawn ? +(raw.discarded / raw.drawn).toFixed(4) : 0, averageDamage: +(raw.damageDealt / successful).toFixed(3), averagePrevention: +(raw.damagePrevented / successful).toFixed(3), winnerGameAssociation: +(raw.winnerGames / successful).toFixed(4) }; }
  for (const card of Object.values(summary.cards)) { card.offeredPerGame = +(card.offered / successful).toFixed(4); card.purchasedPerGame = +(card.purchased / successful).toFixed(4); card.purchaseRateWhenOffered = card.offered ? +(card.purchased / card.offered).toFixed(4) : 0; card.drawnPerGame = +(card.drawn / successful).toFixed(4); card.playedPerGame = +(card.played / successful).toFixed(4); card.effectApplicationsPerPlay = card.played ? +(card.effectApplications / card.played).toFixed(4) : 0; card.unusedDiscardRate = card.drawn ? +(card.discarded / card.drawn).toFixed(4) : 0; card.winCorrelation = card.purchased ? +(card.winnerGames / card.purchased).toFixed(4) : 0; }
  const cards = Object.values(summary.cards); const sampled = cards.filter((card) => card.offered >= 100); summary.outliers = { sampleMinimumOffered: 100, highestPurchaseRateWhenOffered: [...sampled].sort((a, b) => b.purchaseRateWhenOffered - a.purchaseRateWhenOffered).slice(0, 10), lowestPurchaseRateWhenOffered: [...sampled].sort((a, b) => a.purchaseRateWhenOffered - b.purchaseRateWhenOffered).slice(0, 10), highestUnusedDiscardRate: [...sampled].sort((a, b) => b.unusedDiscardRate - a.unusedDiscardRate).slice(0, 10), highestWinCorrelation: [...cards].filter((card) => card.purchased >= 25).sort((a, b) => b.winCorrelation - a.winCorrelation).slice(0, 10), neverActivatedWithPlays: cards.filter((card) => card.played >= 25 && card.effectApplications === 0).sort((a, b) => b.played - a.played).slice(0, 20) };
  summary.progression.promotions = summary.telemetry.promotions; summary.reliability.invariantFailures = summary.invariantFailures.length; summary.reliability.replayMismatches = summary.replay.mismatches; summary.gameLengths = gameSummaries; summary.pathological = { longestGames: [...gameSummaries].sort((a, b) => b.rounds - a.rounds || b.turns - a.turns).slice(0, 20), roundLimitSeeds: gameSummaries.filter((game) => game.reason === "round-limit").map((game) => game.seed), maxRounds: summary.rounds.max, maxTurns: Math.max(0, ...turnValues), cardsWithNoEffectApplicationsAfterPlay: summary.outliers.neverActivatedWithPlays.map((card) => ({ id: card.id, name: card.name, played: card.played })) };
  if (output) await writeSimulationReport(summary, output);
  return summary;
}

export async function writeSimulationReport(summary, output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
  const markdown = output.replace(/\.json$/, ".md");
  const familyRows = Object.entries(summary.families).filter(([family]) => family !== "Other").map(([family, metrics]) => `| ${family} | ${metrics.offeredPerGame} | ${metrics.purchasedPerGame} | ${(metrics.purchaseRateWhenOffered * 100).toFixed(1)}% | ${metrics.drawnPerGame} | ${metrics.playedPerGame} | ${(metrics.unusedDiscardRate * 100).toFixed(1)}% | ${metrics.averageDamage} | ${metrics.averagePrevention} |`).join("\n");
  const consumables = summary.families.Consumables ?? {};
  const strategyRows = Object.entries(summary.strategies).map(([name, strategy]) => `| ${name} | ${strategy.games} | ${strategy.wins} | ${(strategy.winRate * 100).toFixed(1)}% |`).join("\n");
  const failureNote = summary.failures.length ? "Failures retain seed, strategy pair, state, decision history, and event history in the JSON.\n\n" : "";
  await writeFile(markdown, `# Dojo Deckbuilder ${summary.rulesVersion} Core Baseline\n\n${summary.completedGames.toLocaleString()} completed deterministic headless games out of ${summary.gamesAttempted.toLocaleString()} attempted. Seeds begin at ${summary.seedStart}. Canonical scenario: ${summary.scenario?.id ?? "quick-duel"}.\n\n## Reliability\n\n| Metric | Result |\n|---|---:|\n| Completed | ${summary.completedGames} |\n| Failed | ${summary.failedGames} |\n| Invariant failures | ${summary.reliability.invariantFailures} |\n| Replay checks | ${summary.replay.checked} |\n| Replay mismatches | ${summary.replay.mismatches} |\n| Unsupported effects | ${summary.unsupportedEffects} |\n| Unresolved choices | ${summary.reliability.unresolvedChoices} |\n| Round-limit games | ${summary.rounds.roundLimitGames} |\n\n## Game length\n\nAverage **${summary.rounds.average} rounds** (${summary.rounds.percentiles.p50} median; p90 ${summary.rounds.percentiles.p90}; p95 ${summary.rounds.percentiles.p95}; p99 ${summary.rounds.percentiles.p99}; min ${summary.rounds.min}; max ${summary.rounds.max}). Average turns: **${summary.turns.average}**.\n\n## Combat and economy\n\n- Combat: ${(summary.telemetry.attacks / summary.completedGames).toFixed(3)} attacks/game, ${(summary.telemetry.hits / summary.completedGames).toFixed(3)} hits/game, ${(summary.telemetry.blocks / summary.completedGames).toFixed(3)} blocks/game, ${(summary.telemetry.totalDamage / summary.completedGames).toFixed(3)} damage/game, ${(summary.telemetry.damagePrevented / summary.completedGames).toFixed(3)} prevention/game.\n- Economy: ${(summary.economy.openingPurchaseRate * 100).toFixed(1)}% opening purchase rate; ${summary.economy.averagePurchases} purchases/player; ${(summary.telemetry.focusGenerated / (summary.completedGames * 2)).toFixed(3)} Focus generated/player; ${(summary.telemetry.focusSpent / (summary.completedGames * 2)).toFixed(3)} spent/player.\n- Progression: ${summary.progression.averageXpPerPlayer} XP/player; ${summary.progression.promotions} promotions observed; final belts: ${JSON.stringify(summary.progression.beltDistribution)}.\n\n## Card families\n\n| Family | Offered/game | Purchased/game | Purchase when offered | Drawn/game | Played/game | Discarded/drawn* | Damage/game | Prevention/game |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${familyRows}\n\n*Discarded/drawn is a measurable unused-discard proxy; the runtime does not infer intent. Effect applications/play is reported as a count, not a percentage, because one play may apply multiple effects. Winner association is correlation only, not causation.\n\n## Consumables\n\nConsumables were offered ${consumables.offeredPerGame ?? 0} per game, purchased ${consumables.purchasedPerGame ?? 0} per game, and purchased ${(100 * (consumables.purchaseRateWhenOffered ?? 0)).toFixed(1)}% of the time when offered. They were drawn ${consumables.drawnPerGame ?? 0} times/game, played ${consumables.playedPerGame ?? 0} times/game, and had ${(100 * (consumables.unusedDiscardRate ?? 0)).toFixed(1)}% discarded/drawn. They produced ${(consumables.effectApplicationsPerPlay ?? 0).toFixed(3)} effect applications/play; directly attributable contribution was ${consumables.averageDamage ?? 0} damage/game and ${consumables.averagePrevention ?? 0} prevention/game.\n\n## Strategy representation\n\n| Strategy | Seats | Wins | Win rate |\n|---|---:|---:|---:|\n${strategyRows}\n\n## Outliers and pathological seeds\n\nThe JSON contains sample-size-filtered purchase/play/discard/effect outliers and the 20 longest games with reproducible seeds. Cards with fewer than 100 market offers are excluded from rate outlier ranking; winner correlation rankings require at least 25 purchases. No automatic rebalance is implied.\n\n${failureNote}The baseline intentionally leaves canonical Core rules unchanged. Review the progression limitation and findings before controlled experiments.\n`);
}

export function parseArgs(args) {
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  return { games: integer(positional[0], 1000), output: positional[1] ?? option("out", "reports/simulation-current.json"), seedStart: integer(option("seed", 1), 1), scenarioPath: option("scenario", null), replayCheck: option("replay", "true") !== "false", replayCheckEvery: integer(option("replay-every", 100), 100) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = parseArgs(process.argv.slice(2));
  const result = await simulateBatch({ ...args, scenario: args.scenarioPath ? await loadScenario(args.scenarioPath) : null });
  console.log(JSON.stringify({ games: result.games, successfulGames: result.successfulGames, failedGames: result.failedGames, rulesVersion: result.rulesVersion, seedStart: result.seedStart, averageRounds: result.rounds.average, unsupportedEffects: result.unsupportedEffects, invariantFailures: result.invariantFailures.length, replayChecks: result.replay.checked, replayMismatches: result.replay.mismatches, output: args.output }, null, 2));
}
