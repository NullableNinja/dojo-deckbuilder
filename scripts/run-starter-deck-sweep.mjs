import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadGameData } from "../engine/rules-loader.mjs";
import { loadScenario, applyScenario } from "../engine/scenarios.mjs";
import { simulateBatch } from "../engine/simulate.mjs";

const games = Math.max(1, Number.parseInt(process.env.DOJO_SWEEP_GAMES ?? "300", 10) || 300);
const seedStart = Math.max(1, Number.parseInt(process.env.DOJO_SWEEP_SEED_START ?? "200000", 10) || 200000);
const output = resolve(process.env.DOJO_SWEEP_OUTPUT ?? `reports/starter-deck-sweep-${games}.json`);
const data = await loadGameData();
const source = await loadScenario("scenarios/starter-deck-experiment.json");

const starter = (entries) => entries.map(([catalogId, copies]) => ({ catalogId, copies }));
const canonical = starter([
  ["DDB-STA-CORE-001", 5], ["DDB-STA-CORE-002", 1], ["DDB-STA-CORE-003", 1], ["DDB-STA-CORE-004", 1],
  ["DDB-STA-CORE-005", 1], ["DDB-STA-CORE-006", 1], ["DDB-STA-CORE-007", 1], ["DDB-STA-CORE-008", 1],
  ["DDB-STA-CORE-009", 1], ["DDB-STA-CORE-010", 1], ["DDB-STA-CORE-011", 1],
]);
const additionById = Object.fromEntries(source.cardAdditions.map((card) => [card.catalogId, card]));
const effectById = source.cardEffectsPatch.cards;

function scenario(id, deck, additions, effects) {
  return {
    ...structuredClone(source),
    id: `starter-deck-sweep-${id}`,
    description: `Causal sweep variant: ${id}`,
    experiment: { ...structuredClone(source.experiment), sweepVariant: id },
    definitionPatch: { starterDeck: deck },
    cardAdditions: additions.map((card) => structuredClone(card)),
    cardEffectsPatch: { cards: structuredClone(effects) },
  };
}

const reset = additionById["DDB-STA-EXP-001"];
const refresh = additionById["DDB-STA-EXP-002"];
const resetEffect = effectById["DDB-STA-EXP-001"];
const refreshEffect = effectById["DDB-STA-EXP-002"];
const bothKeepHighGuardDeck = starter([
  ["DDB-STA-CORE-001", 3], ["DDB-STA-CORE-002", 1], ["DDB-STA-CORE-003", 1], ["DDB-STA-CORE-004", 1],
  ["DDB-STA-CORE-005", 1], ["DDB-STA-CORE-006", 1], ["DDB-STA-CORE-007", 1], ["DDB-STA-CORE-008", 1],
  ["DDB-STA-CORE-009", 1], ["DDB-STA-CORE-010", 1], ["DDB-STA-CORE-011", 1], ["DDB-STA-EXP-001", 1], ["DDB-STA-EXP-002", 1],
]);
const resetNoCycle = { ...reset, rulesText: "Discard 1 card." };
const resetNoCycleEffect = { name: "Reset Stance", effects: [{ id: "starter-experiment-reset-stance-discard", trigger: "onPlay", action: "discard", target: "self", amount: 1 }] };
const resetNoFocus = { ...reset, focusValue: 0 };
const resetNoFocusNoCycle = { ...resetNoCycle, focusValue: 0 };
const resetJunkReward = {
  ...reset,
  focusValue: 0,
  rulesText: "Discard 1 card. If it has 0 Focus, gain 1 Focus.",
};
const resetJunkRewardEffect = {
  name: "Reset Stance",
  effects: [
    { id: "starter-experiment-reset-stance-discard", trigger: "onPlay", action: "discard", target: "self", amount: 1 },
    { id: "starter-experiment-reset-stance-junk-focus", trigger: "afterResolve", action: "gainFocus", target: "self", amount: 1, conditions: [{ kind: "discardedFocusValue", value: 0 }], resolver: "kata.discardBranch" },
  ],
};
const variants = {
  control: null,
  reset_only: scenario("reset-only", starter([
    ["DDB-STA-CORE-001", 4], ["DDB-STA-CORE-002", 1], ["DDB-STA-CORE-003", 1], ["DDB-STA-CORE-004", 1],
    ["DDB-STA-CORE-005", 1], ["DDB-STA-CORE-006", 1], ["DDB-STA-CORE-007", 1], ["DDB-STA-CORE-008", 1],
    ["DDB-STA-CORE-009", 1], ["DDB-STA-CORE-010", 1], ["DDB-STA-CORE-011", 1], ["DDB-STA-EXP-001", 1],
  ]), [reset], { "DDB-STA-EXP-001": resetEffect }),
  refresh_only: scenario("refresh-only", starter([
    ["DDB-STA-CORE-001", 4], ["DDB-STA-CORE-002", 1], ["DDB-STA-CORE-003", 1], ["DDB-STA-CORE-004", 1],
    ["DDB-STA-CORE-005", 1], ["DDB-STA-CORE-006", 1], ["DDB-STA-CORE-007", 1], ["DDB-STA-CORE-008", 1],
    ["DDB-STA-CORE-009", 1], ["DDB-STA-CORE-010", 1], ["DDB-STA-CORE-011", 1], ["DDB-STA-EXP-002", 1],
  ]), [refresh], { "DDB-STA-EXP-002": refreshEffect }),
  both_keep_high_guard: scenario("both-keep-high-guard", bothKeepHighGuardDeck, [reset, refresh], { "DDB-STA-EXP-001": resetEffect, "DDB-STA-EXP-002": refreshEffect }),
  both_keep_high_guard_no_reset_cycle: scenario("both-keep-high-guard-no-reset-cycle", bothKeepHighGuardDeck, [resetNoCycle, refresh], { "DDB-STA-EXP-001": resetNoCycleEffect, "DDB-STA-EXP-002": refreshEffect }),
  both_keep_high_guard_no_reset_focus: scenario("both-keep-high-guard-no-reset-focus", bothKeepHighGuardDeck, [resetNoFocus, refresh], { "DDB-STA-EXP-001": resetEffect, "DDB-STA-EXP-002": refreshEffect }),
  both_keep_high_guard_no_reset_focus_no_cycle: scenario("both-keep-high-guard-no-reset-focus-no-cycle", bothKeepHighGuardDeck, [resetNoFocusNoCycle, refresh], { "DDB-STA-EXP-001": resetNoCycleEffect, "DDB-STA-EXP-002": refreshEffect }),
  both_keep_high_guard_junk_reward: scenario("both-keep-high-guard-junk-reward", bothKeepHighGuardDeck, [resetJunkReward, refresh], { "DDB-STA-EXP-001": resetJunkRewardEffect, "DDB-STA-EXP-002": refreshEffect }),
  both: source,
  both_no_reset_cycle: (() => {
    return scenario("both-no-reset-cycle", source.definitionPatch.starterDeck, [resetNoCycle, refresh], { "DDB-STA-EXP-001": resetNoCycleEffect, "DDB-STA-EXP-002": refreshEffect });
  })(),
};

function compact(label, summary) {
  const card = (id) => {
    const value = summary.cards[id];
    return value ? { drawn: value.drawn, played: value.played, destroyed: value.destroyed, playedPerGame: value.playedPerGame, winCorrelation: value.winCorrelation } : null;
  };
  return {
    label,
    completedGames: summary.completedGames,
    failedGames: summary.failedGames,
    averageRounds: summary.rounds.average,
    averageTurns: summary.turns.average,
    openingPurchaseRate: summary.economy.openingPurchaseRate,
    averagePurchasesPerPlayer: summary.economy.averagePurchases,
    earlyMarketEngagementRate: summary.starter.earlyMarketEngagementRate,
    averageFirstMarketPurchaseRound: Object.entries(summary.starter.firstMarketPurchaseRound).filter(([key]) => key !== "never").reduce((sum, [key, count]) => sum + Number(key) * count, 0) / Math.max(1, summary.starter.players),
    averageFirstNonStarterCardPlayedRound: Object.entries(summary.starter.firstNonStarterCardPlayedRound).filter(([key]) => key !== "never").reduce((sum, [key, count]) => sum + Number(key) * count, 0) / Math.max(1, summary.starter.players),
    skippedAffordableOffersPerGame: +(summary.telemetry.market.skippedAffordableCards / Math.max(1, summary.completedGames)).toFixed(3),
    cardFamilyDiversityPerPlayer: summary.starter.averageCardFamilyDiversity,
    strategyWinRates: Object.fromEntries(Object.entries(summary.strategies).map(([name, value]) => [name, value.winRate])),
    families: Object.fromEntries(["Attacks", "Defenses", "Katas", "Consumables"].map((family) => [family, { playedPerGame: summary.families[family].playedPerGame, purchaseRateWhenOffered: summary.families[family].purchaseRateWhenOffered }])),
    resetStance: card("DDB-STA-EXP-001"),
    tacticalRefresh: card("DDB-STA-EXP-002"),
    reliability: summary.reliability,
  };
}

const requestedVariants = process.env.DOJO_SWEEP_VARIANTS?.split(",").map((value) => value.trim()).filter(Boolean);
const results = {};
for (const [label, variant] of Object.entries(variants).filter(([label]) => !requestedVariants?.length || requestedVariants.includes(label))) {
  console.log(`Running ${label}: ${games} games`);
  const summary = await simulateBatch({ games, seedStart, data, scenario: variant, replayCheck: true, replayCheckEvery: Math.max(1, Math.floor(games / 20)) });
  results[label] = compact(label, summary);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ reportVersion: 1, gamesPerVariant: games, seedRange: { start: seedStart, end: seedStart + games - 1 }, purpose: "causal starter-card sweep", variants: results, interpretation: "Screening results only. Promote no variant without a larger matched run." }, null, 2)}\n`);
console.log(`Wrote ${output}`);
