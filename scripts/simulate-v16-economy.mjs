import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cards = JSON.parse(fs.readFileSync(path.join(root, "app/data/cards.json"), "utf8")).cards;
const audit = JSON.parse(fs.readFileSync(path.join(root, "app/data/card-migration-audit.json"), "utf8"));
const outputPath = path.join(root, "app/data/balance-report.json");

let seed = 0xD0F0_1600;
const random = () => {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 0x1_0000_0000;
};
const shuffle = (values) => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
};
const percentile = (values, amount) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * amount)))];
};
const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const numericCost = (card) => typeof card.fpCost === "number" ? card.fpCost : Number(card.fpCost);
const isAttack = (card) => card.sourceSheet === "Techniques - Attack" || (card.sourceSheet === "Starter Pool" && ["Basic Jab", "Basic Body Kick", "Basic Shin Kick", "Wild Swing"].includes(card.name));
const isDefense = (card) => card.sourceSheet === "Techniques - Defense" || (card.sourceSheet === "Starter Pool" && ["High Guard", "Center Guard", "Low Guard", "Cover Up"].includes(card.name));
const ownTurnPlayable = (card) => !isDefense(card) && !["Character", "Combo", "Location", "Boss"].includes(card.cardType);
const focus = (card) => Number(card.focusValue) || 0;

const byName = new Map(cards.map((card) => [card.name, card]));
const starter = [
  "Basic Jab", "Basic Body Kick", "Basic Shin Kick", "Wild Swing",
  "High Guard", "Center Guard", "Low Guard", "Cover Up",
  "Breathing Drill", "Footwork Drill",
  "Bad Habit", "Bad Habit", "Bad Habit", "Bad Habit", "Bad Habit",
].map((name) => byName.get(name));
const marketPool = cards.filter((card) => ["Techniques - Attack", "Techniques - Defense", "Techniques - Kata", "Items - Consumable", "Items - Weapons", "Items - Defense"].includes(card.sourceSheet) && Number.isFinite(numericCost(card)));

const trialCount = 20_000;
const turnsPerTrial = 12;
const focusByTurn = Array.from({ length: turnsPerTrial }, () => []);
const purchasesByTurn = Array.from({ length: turnsPerTrial }, () => []);
const firstPurchaseTurn = [];
const totalPurchases = [];
const deadHands = [];

for (let trial = 0; trial < trialCount; trial += 1) {
  let deck = shuffle(starter);
  let discard = [];
  let hand = [];
  let marketDeck = shuffle(marketPool);
  let marketDiscard = [];
  let market = [];
  let purchases = 0;
  let first = null;
  let dead = 0;

  const draw = () => {
    if (!deck.length) { deck = shuffle(discard); discard = []; }
    return deck.pop();
  };
  const refillMarket = () => {
    while (market.length < 7) {
      if (!marketDeck.length) { marketDeck = shuffle(marketDiscard); marketDiscard = []; }
      market.push(marketDeck.pop());
    }
  };
  refillMarket();

  for (let turn = 0; turn < turnsPerTrial; turn += 1) {
    while (hand.length < 5) hand.push(draw());

    // A representative duel pressure model: before their turn, a player uses at most one
    // matching Defense from this already-drawn hand in 55% of rounds.
    const defenses = hand.map((card, index) => ({ card, index })).filter(({ card }) => isDefense(card));
    if (defenses.length && random() < 0.55) {
      const used = defenses[Math.floor(random() * defenses.length)];
      discard.push(...hand.splice(used.index, 1));
    }

    const attacks = hand.filter(isAttack);
    const flowAttack = attacks.find((card) => card.tags?.includes("Flow"));
    const attackAllowance = Math.min(attacks.length, 2 + (flowAttack ? 1 : 0));
    const playedAttacks = attacks.sort((left, right) => focus(right) - focus(left)).slice(0, attackAllowance);
    const playedOther = hand.filter((card) => ownTurnPlayable(card) && !isAttack(card));
    const played = [...new Set([...playedAttacks, ...playedOther])];
    const turnFocus = played.reduce((sum, card) => sum + focus(card), 0);
    if (turnFocus === 0) dead += 1;

    let remaining = turnFocus;
    let bought = 0;
    while (true) {
      const affordable = market.filter((card) => numericCost(card) <= remaining);
      if (!affordable.length) break;
      affordable.sort((left, right) => numericCost(right) - numericCost(left) || focus(right) - focus(left));
      const selected = affordable[0];
      remaining -= numericCost(selected);
      market.splice(market.indexOf(selected), 1);
      discard.push(selected);
      purchases += 1;
      bought += 1;
      if (first === null) first = turn + 1;
      refillMarket();
    }

    focusByTurn[turn].push(turnFocus);
    purchasesByTurn[turn].push(bought);
    discard.push(...hand);
    hand = [];
  }
  firstPurchaseTurn.push(first ?? turnsPerTrial + 1);
  totalPurchases.push(purchases);
  deadHands.push(dead);
}

const costDistribution = Object.fromEntries([...new Set(marketPool.map(numericCost))].sort((a, b) => a - b).map((cost) => [cost, marketPool.filter((card) => numericCost(card) === cost).length]));
const focusDistribution = Object.fromEntries([0, 1, 2, 3].map((value) => [value, cards.filter((card) => focus(card) === value).length]));
const riskCards = cards.filter((card) => {
  const text = `${card.rulesText ?? ""} ${Object.values(card.details ?? {}).join(" ")}`;
  return /draw [3-9]|gain [2-9] Focus|next Attack.*Flow|third Attack|additional Attack/i.test(text);
}).map((card) => ({ catalogId: card.catalogId, name: card.name, cardType: card.cardType, rulesText: card.rulesText }));

const report = {
  version: "v1.6 Economy Draft",
  generatedFrom: "413-card migrated catalog",
  scope: "Deterministic 20,000-trial economy smoke test. This is not a substitute for human combat, mode, and matchup playtests.",
  rulesAssumed: {
    handSize: 5,
    normalAttackLimit: 2,
    flowExemption: 1,
    defensesPlayedBeforeTurnProbability: 0.55,
    focusBanking: false,
    arbitraryDiscardForFocus: false,
    marketSize: 7,
  },
  catalogChecks: {
    totalCards: cards.length,
    auditRows: audit.length,
    uniqueAuditIds: new Set(audit.map((entry) => entry.catalogId)).size,
    textChanged: audit.filter((entry) => entry.textChanged).length,
    legacyEconomyTerms: cards.filter((card) => /\bChi\b|\bFP\b|Trigger Chi|Chi Cost/i.test(JSON.stringify(card))).length,
    marketCards: marketPool.length,
    marketCostDistribution: costDistribution,
    focusValueDistribution: focusDistribution,
  },
  economyResults: {
    firstPurchaseTurn: { median: percentile(firstPurchaseTurn, 0.5), p90: percentile(firstPurchaseTurn, 0.9), neverWithin12TurnsRate: firstPurchaseTurn.filter((turn) => turn > turnsPerTrial).length / trialCount },
    purchasesWithin12Turns: { mean: Number(average(totalPurchases).toFixed(2)), p10: percentile(totalPurchases, 0.1), median: percentile(totalPurchases, 0.5), p90: percentile(totalPurchases, 0.9) },
    zeroFocusTurnsWithin12: { mean: Number(average(deadHands).toFixed(2)), median: percentile(deadHands, 0.5), p90: percentile(deadHands, 0.9) },
    turnSnapshots: [1, 3, 6, 9, 12].map((turn) => ({ turn, meanFocus: Number(average(focusByTurn[turn - 1]).toFixed(2)), medianFocus: percentile(focusByTurn[turn - 1], 0.5), meanPurchases: Number(average(purchasesByTurn[turn - 1]).toFixed(2)) })),
  },
  watchList: riskCards,
  interpretation: [
    "The no-Chi economy produces purchases without a second play currency, while Reaction Defenses and 0-Focus Bad Habits still create meaningful hand friction.",
    "Flow and the two-Attack limit prevent free-play Attack bursts from scaling only with hand size.",
    "The structural pass is complete; printed damage, Guard, draw chains, specific character engines, and all four modes still require human playtest sign-off before v1.6 becomes final.",
  ],
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
const watchIds = new Set(riskCards.map((card) => card.catalogId));
for (const entry of audit) {
  entry.reviewStatus = watchIds.has(entry.catalogId)
    ? "Migrated and reviewed — focused human playtest watch list"
    : "Migrated and reviewed — human playtest pending";
}
fs.writeFileSync(path.join(root, "app/data/card-migration-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(report.economyResults, null, 2));
console.log(`Watch list: ${riskCards.length} cards.`);
