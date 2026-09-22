import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { loadGameData } from "./rules-loader.mjs";
import { CARD_FAMILIES } from "./core.mjs";
import { requireExecutableMode } from "./modes.mjs";

const CARD_KEYS = ["offered", "drawn", "purchased", "played", "discarded", "destroyed", "hits", "blocks", "damageDealt", "damagePrevented", "effectApplications", "equipmentReadied", "equipmentExhausted", "learned", "activated"];
const integer = (value, fallback) => Math.max(1, Number.parseInt(String(value ?? fallback), 10) || fallback);
const emptyFamily = () => Object.fromEntries([...CARD_KEYS, "winnerGames"].map((key) => [key, 0]));
const emptyFamilies = () => Object.fromEntries(CARD_FAMILIES.map((family) => [family, emptyFamily()]));
const addNumbers = (target, source) => { for (const [key, value] of Object.entries(source ?? {})) if (typeof value === "number") target[key] = (target[key] ?? 0) + value; };
const quantile = (values, p) => { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const index = (sorted.length - 1) * p; const low = Math.floor(index); const high = Math.ceil(index); return +(sorted[low] + (sorted[high] - sorted[low]) * (index - low)).toFixed(2); };

function parseArgs(args) {
  const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const output = positional[1] ?? option("out", "reports/offline-simulation.json");
  return {
    games: integer(positional[0] ?? option("games", 1000), 1000), seedStart: integer(option("seed", 1), 1), mode: option("mode", null),
    workers: integer(option("workers", Math.min(availableParallelism(), 8)), Math.min(availableParallelism(), 8)), policy: option("policy", "baseline"),
    detail: ["summary", "games", "full"].includes(option("telemetry", "games")) ? option("telemetry", "games") : "games",
    replayEvery: Math.max(0, Number.parseInt(option("replay-every", 100), 10) || 0), output,
    gameOutput: option("games-out", output.replace(/\.json$/i, ".games.jsonl")),
  };
}

function makeSummary({ args, data, mode }) {
  return {
    schemaVersion: 1, runnerVersion: "parallel-simulate-v1", generatedAt: new Date().toISOString(), rulesVersion: data.definition.rulesVersion, rulesRevision: data.definition.rulesRevision,
    mode: { id: mode.id, definition: mode }, playerCount: mode.players ?? 2, policy: args.policy, gamesRequested: args.games, seedStart: args.seedStart, workers: args.workers, telemetryDetail: args.detail,
    gamesCompleted: 0, gamesFailed: 0, rounds: { sum: 0, average: 0, min: Infinity, max: 0, p50: 0, p90: 0, p95: 0, p99: 0, roundLimitGames: 0 }, turns: { sum: 0, average: 0, min: Infinity, max: 0, p50: 0, p90: 0, p95: 0, p99: 0 },
    telemetry: { attacks: 0, hits: 0, blocks: 0, totalDamage: 0, damagePrevented: 0, cardsPlayed: 0, cardsAcquired: 0, cardsDrawn: 0, cardsDiscarded: 0, cardsDestroyed: 0, cardsRevealed: 0, equipmentReadied: 0, equipmentExhausted: 0, focusGenerated: 0, focusSpent: 0, xpGenerated: 0, defensePractice: 0, promotions: 0, comboOpportunities: 0, comboAcquisitions: 0, comboActivations: 0, comboEffectsResolved: 0, effectApplications: 0, choicesPresented: 0, choicesResolved: 0, lifecycleEvents: 0, unsupportedEffects: 0, families: emptyFamilies() },
    reliability: { unsupportedEffectEvents: 0, invariantFailures: 0, replayChecks: 0, replayMismatches: 0, unresolvedChoices: 0, illegalActions: 0, stalls: 0 },
    economy: { openingPurchasePlayers: 0, openingPurchaseRate: 0, totalPurchases: 0, averagePurchasesPerPlayer: 0 }, progression: { averageXpPerPlayer: 0, maxXp: 0, promotions: 0, comboOwners: 0, comboUsers: 0, comboUses: 0, promotionByTransition: {}, beltDistribution: {} },
    boss: { stages: 0, stageTransitions: 0, arsenalRevealed: 0, bossAttacks: 0, bossHits: 0, bossBlocks: 0, bossDamage: 0, bossDamagePrevented: 0, bossGuardUses: 0, guardUses: 0, enrageTurns: 0 },
    strategies: {}, matchups: {}, cards: {}, families: {}, failures: [], longestGames: [], replaySeeds: [], output: { games: args.gameOutput },
  };
}

function addGame(summary, result, roundValues, turnValues, data) {
  if (!result.ok) {
    summary.gamesFailed += 1; if (result.invariantFailures?.length) summary.reliability.invariantFailures += 1; if (/No legal actions|illegal action|illegal choice/.test(result.message)) summary.reliability.illegalActions += 1; if (/exceeded/.test(result.message)) summary.reliability.stalls += 1;
    summary.failures.push(result); return;
  }
  summary.gamesCompleted += 1; roundValues.push(result.rounds); turnValues.push(result.turns); summary.rounds.sum += result.rounds; summary.rounds.min = Math.min(summary.rounds.min, result.rounds); summary.rounds.max = Math.max(summary.rounds.max, result.rounds); summary.turns.sum += result.turns; summary.turns.min = Math.min(summary.turns.min, result.turns); summary.turns.max = Math.max(summary.turns.max, result.turns); if (result.reason === "round-limit") summary.rounds.roundLimitGames += 1;
  for (const [key, value] of Object.entries(result.telemetry)) { if (key === "families") { for (const [family, values] of Object.entries(value)) addNumbers(summary.telemetry.families[family] ??= {}, values); } else if (typeof value === "number" && key in summary.telemetry) summary.telemetry[key] += value; }
  addNumbers(summary.boss, result.telemetry.boss ?? result.scenario?.bossStats);
  for (const player of result.players.filter((candidate) => !candidate.isBoss)) { const strategy = summary.strategies[player.strategy] ??= { games: 0, wins: 0, winRate: 0 }; strategy.games += 1; if (player.id === result.winner) strategy.wins += 1; summary.economy.totalPurchases += player.purchases; summary.economy.openingPurchasePlayers += player.openingPurchase ? 1 : 0; const belt = String(player.beltIndex); summary.progression.beltDistribution[belt] = (summary.progression.beltDistribution[belt] ?? 0) + 1; summary.progression.maxXp = Math.max(summary.progression.maxXp, player.xp); summary.progression.averageXpPerPlayer += player.xp; if (player.learnedCombos?.length) summary.progression.comboOwners += 1; if (player.comboTriggered) summary.progression.comboUsers += 1; for (const promotion of player.promotionHistory ?? []) { const transition = `${data.definition.progression.belts[promotion.from]?.name ?? promotion.from}->${data.definition.progression.belts[promotion.to]?.name ?? promotion.to}`; summary.progression.promotionByTransition[transition] = (summary.progression.promotionByTransition[transition] ?? 0) + 1; } }
  summary.progression.comboUses += result.telemetry.comboActivations ?? 0;
  const matchupKey = `${result.strategies[0]} vs ${result.strategies[1]}`; const matchup = summary.matchups[matchupKey] ??= { games: 0, wins: {} }; matchup.games += 1; const winnerStrategy = result.players[result.winner]?.strategy; if (winnerStrategy) matchup.wins[winnerStrategy] = (matchup.wins[winnerStrategy] ?? 0) + 1;
  summary.reliability.unsupportedEffectEvents += result.unsupportedEffects; if (result.state?.pendingChoice) summary.reliability.unresolvedChoices += 1; if (result.replay?.checked) { summary.reliability.replayChecks += 1; summary.replaySeeds.push(result.seed); if (!result.replay.matches) summary.reliability.replayMismatches += 1; }
  for (const card of result.cards) { const aggregate = summary.cards[card.id] ??= { id: card.id, name: card.name, family: card.family ?? "Other", ...Object.fromEntries([...CARD_KEYS, "winnerGames"].map((key) => [key, 0])) }; for (const key of [...CARD_KEYS, "winnerOwned"]) aggregate[key === "winnerOwned" ? "winnerGames" : key] += card[key] ?? 0; }
  const existing = summary.longestGames; existing.push({ seed: result.seed, rounds: result.rounds, turns: result.turns, winner: result.winner, reason: result.reason, finalHp: result.players.map((player) => player.hp), strategies: result.strategies }); existing.sort((a, b) => b.rounds - a.rounds || b.turns - a.turns); if (existing.length > 20) existing.length = 20;
}

function finalize(summary, roundValues, turnValues, data) {
  const games = summary.gamesCompleted || 1;
  summary.rounds.average = +(summary.rounds.sum / games).toFixed(2); summary.rounds.min = Number.isFinite(summary.rounds.min) ? summary.rounds.min : 0; summary.rounds.p50 = quantile(roundValues, 0.5); summary.rounds.p90 = quantile(roundValues, 0.9); summary.rounds.p95 = quantile(roundValues, 0.95); summary.rounds.p99 = quantile(roundValues, 0.99);
  summary.turns.average = +(summary.turns.sum / games).toFixed(2); summary.turns.min = Number.isFinite(summary.turns.min) ? summary.turns.min : 0; summary.turns.p50 = quantile(turnValues, 0.5); summary.turns.p90 = quantile(turnValues, 0.9); summary.turns.p95 = quantile(turnValues, 0.95); summary.turns.p99 = quantile(turnValues, 0.99); summary.economy.openingPurchaseRate = +(summary.economy.openingPurchasePlayers / (games * summary.playerCount)).toFixed(4); summary.economy.averagePurchasesPerPlayer = +(summary.economy.totalPurchases / (games * summary.playerCount)).toFixed(3); summary.progression.averageXpPerPlayer = +(summary.progression.averageXpPerPlayer / (games * summary.playerCount)).toFixed(3); summary.progression.promotions = summary.telemetry.promotions; summary.reliability.invariantFailures = summary.failures.filter((failure) => failure.invariantFailures?.length).length; summary.boss.averageAttacksPerGame = +(summary.boss.bossAttacks / games).toFixed(3); summary.boss.averageDamagePerGame = +(summary.boss.bossDamage / games).toFixed(3); summary.boss.averageDamagePreventedPerGame = +(summary.boss.bossDamagePrevented / games).toFixed(3);
  const beltNames = data.definition.progression?.belts ?? [];
  summary.progression.beltDistribution = Object.fromEntries(Object.entries(summary.progression.beltDistribution).map(([index, count]) => [beltNames[Number(index)]?.name ?? index, count]));
  for (const strategy of Object.values(summary.strategies)) strategy.winRate = strategy.games ? +(strategy.wins / strategy.games).toFixed(4) : 0;
  for (const [family, raw] of Object.entries(summary.telemetry.families)) summary.families[family] = { ...raw, offeredPerGame: +(raw.offered / games).toFixed(3), purchasedPerGame: +(raw.purchased / games).toFixed(3), purchaseRateWhenOffered: raw.offered ? +(raw.purchased / raw.offered).toFixed(4) : 0, drawnPerGame: +(raw.drawn / games).toFixed(3), playedPerGame: +(raw.played / games).toFixed(3), effectApplicationsPerPlay: raw.played ? +(raw.effectApplications / raw.played).toFixed(4) : 0, unusedDiscardRate: raw.drawn ? +(raw.discarded / raw.drawn).toFixed(4) : 0, averageDamage: +(raw.damageDealt / games).toFixed(3), averagePrevention: +(raw.damagePrevented / games).toFixed(3), winnerGameAssociation: +(raw.winnerGames / games).toFixed(4) };
  for (const card of Object.values(summary.cards)) { card.offeredPerGame = +(card.offered / games).toFixed(4); card.purchasedPerGame = +(card.purchased / games).toFixed(4); card.purchaseRateWhenOffered = card.offered ? +(card.purchased / card.offered).toFixed(4) : 0; card.drawnPerGame = +(card.drawn / games).toFixed(4); card.playedPerGame = +(card.played / games).toFixed(4); card.effectApplicationsPerPlay = card.played ? +(card.effectApplications / card.played).toFixed(4) : 0; card.unusedDiscardRate = card.drawn ? +(card.discarded / card.drawn).toFixed(4) : 0; card.winCorrelation = card.purchased ? +(card.winnerGames / card.purchased).toFixed(4) : 0; }
  summary.source = { canonicalDefinition: "content/dojo-game.json", generatedData: "app/data/", catalogCards: data.cards.length };
  return summary;
}

export async function writeReports(summary, output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
  const rows = Object.entries(summary.families).filter(([family]) => family !== "Other").map(([family, value]) => `| ${family} | ${value.offeredPerGame} | ${value.purchasedPerGame} | ${(value.purchaseRateWhenOffered * 100).toFixed(1)}% | ${value.drawnPerGame} | ${value.playedPerGame} | ${value.effectApplicationsPerPlay} |`).join("\n");
  const consumables = summary.families.Consumables ?? {};
  const belts = Object.entries(summary.progression.beltDistribution).map(([belt, count]) => `${belt}: ${count}`).join(", ");
  await writeFile(output.replace(/\.json$/i, ".md"), `# Offline Dojo Deckbuilder Simulation\n\n- Rules: **${summary.rulesVersion}/${summary.rulesRevision}**\n- Mode: **${summary.mode.id}**\n- Games: **${summary.gamesCompleted}/${summary.gamesRequested}** completed\n- Workers: **${summary.workers}**\n\n## Reliability\n\n| Metric | Result |\n|---|---:|\n| Failures | ${summary.gamesFailed} |\n| Invariant failures | ${summary.reliability.invariantFailures} |\n| Replay checks | ${summary.reliability.replayChecks} |\n| Replay mismatches | ${summary.reliability.replayMismatches} |\n| Unsupported effects | ${summary.reliability.unsupportedEffectEvents} |\n| Unresolved choices | ${summary.reliability.unresolvedChoices} |\n| Round-limit games | ${summary.rounds.roundLimitGames} |\n\n## Game length\n\nAverage ${summary.rounds.average} rounds; median ${summary.rounds.p50}; p90 ${summary.rounds.p90}; p95 ${summary.rounds.p95}; p99 ${summary.rounds.p99}; max ${summary.rounds.max}.\n\n## Progression and Combos\n\n- Promotions: **${summary.progression.promotions}**; transitions: ${JSON.stringify(summary.progression.promotionByTransition)}\n- Final belt distribution: ${belts}\n- Combo opportunities: **${summary.telemetry.comboOpportunities}**; acquisitions: **${summary.telemetry.comboAcquisitions}**; owners: **${summary.progression.comboOwners}**; users: **${summary.progression.comboUsers}**; activations: **${summary.progression.comboUses}**; resolved effects: **${summary.telemetry.comboEffectsResolved}**\n\n## Families\n\n| Family | Offered/game | Purchased/game | Purchase when offered | Drawn/game | Played/game | Effect applications/play |\n|---|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## Consumables\n\nConsumables: ${consumables.offeredPerGame ?? 0} offered/game, ${consumables.purchasedPerGame ?? 0} purchased/game, ${(100 * (consumables.purchaseRateWhenOffered ?? 0)).toFixed(1)}% purchase rate when offered, ${consumables.drawnPerGame ?? 0} drawn/game, ${consumables.playedPerGame ?? 0} played/game, ${(100 * (consumables.unusedDiscardRate ?? 0)).toFixed(1)}% discarded/drawn.\n\nThe JSON and JSONL outputs contain the full machine-readable telemetry selected by the run. Winner association is correlation only.\n`);
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args); const data = await loadGameData({ modeId: options.mode }); const mode = requireExecutableMode(data, options.mode); options.mode = mode.id; options.workers = Math.max(1, Math.min(options.workers, options.games));
  const summary = makeSummary({ args: options, data, mode }); const roundValues = []; const turnValues = [];
  await Promise.all([mkdir(dirname(options.output), { recursive: true }), mkdir(dirname(options.gameOutput), { recursive: true })]);
  const gameStream = options.detail === "summary" ? null : createWriteStream(options.gameOutput, { encoding: "utf8" });
  if (gameStream) await new Promise((resolveStream, reject) => { gameStream.once("open", resolveStream); gameStream.once("error", reject); });
  await Promise.all(Array.from({ length: options.workers }, (_, workerId) => new Promise((resolveWorker, rejectWorker) => {
    const worker = new Worker(new URL("./parallel-worker.mjs", import.meta.url), { workerData: { ...options, workerId, workerCount: options.workers } });
    worker.on("message", (message) => {
      try {
        if (message.type === "game") {
          addGame(summary, message.result, roundValues, turnValues, data);
          if (gameStream) gameStream.write(`${JSON.stringify(message.result)}\n`);
        }
      } catch (error) { rejectWorker(error); }
    });
    worker.once("error", rejectWorker);
    worker.once("exit", (code) => code === 0 ? resolveWorker() : rejectWorker(new Error(`Simulation worker exited with code ${code}`)));
  })));
  if (gameStream) await new Promise((resolveStream, reject) => { gameStream.once("finish", resolveStream); gameStream.once("error", reject); gameStream.end(); });
  finalize(summary, roundValues, turnValues, data); await writeReports(summary, options.output); return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const summary = await main(); console.log(JSON.stringify({ mode: summary.mode.id, gamesRequested: summary.gamesRequested, gamesCompleted: summary.gamesCompleted, gamesFailed: summary.gamesFailed, workers: summary.workers, output: summary.output, replayMismatches: summary.reliability.replayMismatches }, null, 2)); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

export { main, parseArgs };
