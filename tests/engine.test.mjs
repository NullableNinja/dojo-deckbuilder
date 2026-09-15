import assert from "node:assert/strict";
import test from "node:test";
import { loadGameData } from "../engine/rules-loader.mjs";
import { Game } from "../engine/core.mjs";

const starterCards = (data) => data.definition.starterDeck
  .map((entry) => data.byId.get(entry.catalogId))
  .filter(Boolean);
const starterAttacks = (data) => starterCards(data).filter((card) => Number(card.stats?.["Attack Power"]) > 0);
const starterDefenses = (data) => starterCards(data).filter((card) => Number(card.stats?.Guard) > 0);

test("engine loads canonical game data without hard-coded inventory assumptions", async () => {
  const data = await loadGameData();
  assert.ok(data.definition, "canonical game definition must load");
  assert.ok(data.definition.rulesVersion, "canonical game definition must identify its rules version");
  assert.ok(Array.isArray(data.cards) && data.cards.length > 0, "canonical card catalog must load");
  assert.ok(data.byId instanceof Map && data.byId.size > 0, "canonical card lookup must be populated");
  assert.ok(data.definition.economy, "canonical economy rules must load");
});

test("seeded games are deterministic and terminate legally", async () => {
  const data = await loadGameData();
  const first = new Game(data, { seed: 42, strategies: ["economy", "aggression"] }).run();
  const second = new Game(data, { seed: 42, strategies: ["economy", "aggression"] }).run();
  assert.deepEqual(first, second);
  assert.ok(first.winner === 0 || first.winner === 1);
  assert.ok(first.rounds <= data.definition.mode.maxRounds + 1);
});

test("Defense Practice grants printed Focus without changing HP", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 3 });
  const player = game.players[0];
  const defense = player.hand.find((card) => Number(card.stats?.Guard) > 0) ?? starterDefenses(data)[0];
  assert.ok(defense, "canonical Starter deck must contain a Defense card");
  if (!player.hand.includes(defense)) player.hand.push(defense);
  const hp = player.hp;
  assert.equal(game.practice(player, defense), true);
  assert.equal(player.focus, Number(defense.focusValue));
  assert.equal(player.hp, hp);
});

test("played Defense is consumed and cannot block a second Attack", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 9 });
  const attacker = game.players[0];
  const defender = game.players[1];
  const attacks = starterAttacks(data).slice(0, 2);
  const defense = starterDefenses(data)[0];
  assert.equal(attacks.length, 2, "canonical Starter deck must contain at least two Attacks");
  assert.ok(defense, "canonical Starter deck must contain a Defense");
  attacker.hand.push(...attacks);
  defender.hand.push(defense);
  const beforeFocus = defender.focus;
  const first = game.resolveAttack(attacker, defender, attacks[0], { defenseCard: defense });
  const second = game.resolveAttack(attacker, defender, attacks[1], { defenseCard: null });
  assert.equal(defender.focus, beforeFocus + Number(defense.focusValue));
  assert.equal(first.defense, defense);
  assert.equal(second.defense, null);
  assert.ok(defender.discard.includes(defense));
  assert.ok(!defender.played.includes(defense));
});

test("Market purchase spends only the printed cost and refills one slot", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 13 });
  const player = game.players[0];
  const bought = game.market.find((card) => Number.parseInt(String(card.fpCost), 10) <= 4) ?? game.market[0];
  assert.ok(bought, "market must contain a purchasable card");
  const price = Number.parseInt(String(bought.fpCost), 10) || 0;
  player.focus = price + 3;
  const beforeDeck = game.marketDeck.length;
  assert.equal(game.buy(player, bought), true);
  assert.equal(player.focus, 3);
  assert.equal(game.market.length, data.definition.economy.market.rowSize);
  assert.equal(game.marketDeck.length, beforeDeck - 1);
  assert.equal(game.marketPurchasedThisRound, true);
  assert.ok(player.discard.includes(bought));
});

test("a turn may play every legal Attack in hand", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 21 });
  const player = game.players[0];
  const defender = game.players[1];
  const attacks = starterAttacks(data).slice(0, 3);
  assert.equal(attacks.length, 3, "canonical Starter deck must contain at least three Attacks");
  player.hand = [...attacks];
  player.deck = [];
  player.discard = [];
  defender.hp = 100;
  game.botTurn(0);
  assert.equal(game.events.filter((event) => event.type === "attack" && event.attacker === 0).length, attacks.length);
});
