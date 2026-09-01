import cardsJson from "./data/cards.json";
import definition from "./data/game-definition.json";
import rules from "./data/rules.json";
import { Game } from "../engine/core.mjs";
import { STRATEGIES } from "../engine/bots.mjs";

const data = {
  definition,
  rules,
  cards: cardsJson.cards,
  byId: new Map(cardsJson.cards.map((card) => [card.catalogId, card])),
};

self.onmessage = ({ data: message }) => {
  const games = Math.max(1, Math.min(1000, Number.parseInt(message?.games ?? 100, 10) || 100));
  const summary = {
    games,
    rulesVersion: definition.rulesVersion,
    wins: Object.fromEntries(STRATEGIES.map((strategy) => [strategy, { games: 0, wins: 0 }])),
    rounds: 0,
    turns: 0,
    roundLimitGames: 0,
    purchases: 0,
    cardPicks: {},
    curves: {},
  };

  for (let index = 0; index < games; index += 1) {
    const strategies = [STRATEGIES[index % STRATEGIES.length], STRATEGIES[Math.floor(index / STRATEGIES.length) % STRATEGIES.length]];
    const result = new Game(data, { seed: index + 1, strategies }).run();
    summary.rounds += result.rounds;
    summary.turns += result.turns;
    if (result.reason === "round-limit") summary.roundLimitGames += 1;
    for (const player of result.players) {
      summary.wins[player.strategy].games += 1;
      if (player.id === result.winner) summary.wins[player.strategy].wins += 1;
      summary.purchases += player.purchases;
    }
    for (const card of result.cards) {
      const current = summary.cardPicks[card.id] ?? { name: card.name, purchases: 0 };
      current.purchases += card.purchased;
      summary.cardPicks[card.id] = current;
    }
    for (const event of result.events) {
      if (event.type !== "turn-snapshot") continue;
      const point = summary.curves[event.round] ?? { samples: 0, xp: 0, focus: 0 };
      point.samples += 1;
      point.xp += event.xp;
      point.focus += event.focus;
      summary.curves[event.round] = point;
    }
    if ((index + 1) % 25 === 0 || index + 1 === games) self.postMessage({ type: "progress", completed: index + 1, games });
  }

  const curves = Object.entries(summary.curves).map(([round, point]) => ({
    round: Number(round),
    xp: +(point.xp / point.samples).toFixed(2),
    focus: +(point.focus / point.samples).toFixed(2),
  }));
  const cardPicks = Object.entries(summary.cardPicks)
    .map(([id, card]) => ({ id, name: card.name, purchases: card.purchases, pickRate: +(card.purchases / games).toFixed(3) }))
    .sort((left, right) => right.purchases - left.purchases)
    .slice(0, 8);
  const wins = Object.fromEntries(Object.entries(summary.wins).map(([strategy, record]) => [strategy, {
    ...record,
    winRate: record.games ? +(record.wins / record.games).toFixed(3) : 0,
  }]));

  self.postMessage({
    type: "complete",
    result: {
      games,
      rulesVersion: summary.rulesVersion,
      averageRounds: +(summary.rounds / games).toFixed(2),
      averageTurns: +(summary.turns / games).toFixed(2),
      roundLimitRate: +(summary.roundLimitGames / games).toFixed(3),
      averagePurchases: +(summary.purchases / (games * 2)).toFixed(2),
      wins,
      curves,
      cardPicks,
    },
  });
};
