import assert from "node:assert/strict";
import test from "node:test";
import { loadGameData } from "../engine/rules-loader.mjs";
import { Game } from "../engine/core.mjs";
import { simulateBatch } from "../engine/simulate.mjs";
import { analyzeEffectCoverage } from "../engine/coverage.mjs";

test("headless engine exposes canonical phases, legal actions, and serializable state", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 101 });
  assert.equal(game.phase, "Honor");
  assert.deepEqual(game.getLegalActions(0), [{ type: "pass", playerId: 0 }]);
  game.advanceAutomaticEvents();
  assert.equal(game.phase, "Initiate");
  assert.ok(game.getLegalActions(game.activePlayer).some((action) => action.type === "pass"));
  assert.doesNotThrow(() => JSON.stringify(game.getState()));
});

test("attack and defense choices suspend and resume through one action contract", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 102 });
  game.advanceAutomaticEvents();
  game.applyAction({ type: "pass", playerId: game.activePlayer });
  const attacker = game.activePlayer;
  const attack = game.players[attacker].hand.find((card) => Number(card.stats?.["Attack Power"]) > 0);
  assert.ok(attack);
  assert.equal(game.applyAction({ type: "play-attack", playerId: attacker, cardId: attack.instanceId }), true);
  if (game.getPendingChoice()?.kind === "attack-zone") {
    assert.equal(game.applyAction({ type: "resolve-choice", choice: { optionId: "Mid" } }), true);
  }
  assert.equal(game.getPendingChoice()?.kind, "defense");
  assert.equal(game.applyAction({ type: "resolve-choice", playerId: game.getPendingChoice().playerId, choice: { optionId: "pass" } }), true);
  assert.equal(game.getPendingChoice(), null);
  assert.equal(game.events.filter((event) => event.type === "attack").length, 1);
});

test("supported starter effects execute from the canonical card-effect registry", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 103 });
  game.advanceAutomaticEvents();
  game.applyAction({ type: "pass", playerId: game.activePlayer });
  const player = game.players[game.activePlayer];
  const breathing = game.cardInstance(data.byId.get("DDB-STA-CORE-005"));
  player.hand.push(breathing);
  assert.equal(game.applyAction({ type: "play-card", playerId: player.id, cardId: breathing.instanceId }), true);
  assert.equal(player.nextAttackPower, 1);
  assert.equal(game.telemetry.unsupportedEffects, 0);
});

test("generic card movement exposes a deterministic serializable choice", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 104 });
  const player = game.players[0];
  const source = game.cardInstance(data.byId.get("DDB-STA-CORE-005"));
  const selected = game.cardInstance(data.byId.get("DDB-STA-CORE-008"));
  player.hand.push(source, selected);
  game.effects.set(source.catalogId, { effects: [{ id: "test-discard", trigger: "onPlay", action: "discard", target: "self", amount: 1, duration: "immediate" }] });
  assert.equal(game.playCard(player, source), true);
  assert.equal(game.getPendingChoice()?.kind, "card-movement");
  assert.ok(game.getPendingChoice().options.some((option) => option.id === selected.instanceId));
  assert.ok(!game.getPendingChoice().options.some((option) => option.id === source.instanceId));
  assert.equal(game.resolveChoice({ optionId: selected.instanceId }), true);
  assert.ok(player.discard.includes(selected));
  assert.equal(game.checkInvariants().length, 0);
  assert.equal(game.telemetry.unsupportedEffects, 0);
});

test("generic equipment ready and exhaust actions mutate persistent equipment state", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 105 });
  const player = game.players[0];
  const equipment = game.cardInstance(data.byId.get("DDB-DEQ-CORE-003"));
  player.hand.push(equipment);
  game.effects.set(equipment.catalogId, { effects: [
    { id: "test-exhaust", trigger: "onPlay", action: "exhaust", target: "source", amount: 1, duration: "immediate" },
    { id: "test-ready", trigger: "onInitiate", action: "ready", target: "source", amount: 1, duration: "immediate" },
  ] });
  assert.equal(game.playCard(player, equipment), true);
  assert.ok(player.exhaustedEquipment.includes(equipment.instanceId));
  game.applyCardEffects(player, equipment, "onInitiate", { opponent: game.players[1] });
  assert.equal(player.exhaustedEquipment.includes(equipment.instanceId), false);
  assert.equal(game.checkInvariants().length, 0);
  assert.equal(game.telemetry.unsupportedEffects, 0);
});

test("Flow and Reaction Item effects use the shared headless event path", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 106 });
  const attacker = game.players[0];
  const defender = game.players[1];
  const attack = game.cardInstance(data.byId.get("DDB-STA-CORE-002"));
  attack.tags = [...(attack.tags ?? []), "Flow"];
  const reaction = game.cardInstance(data.byId.get("DDB-RIT-CORE-002"));
  attacker.hand.push(attack);
  defender.hand.push(reaction);
  game.effects.set(reaction.catalogId, { effects: [{ id: "test-reaction", trigger: "onAttackDeclared", target: "self", amount: 3, resolver: "reaction.preventIncomingDamage", action: "custom", effect: "core.custom", conditions: [{ kind: "incomingAttackTargetsSelf" }] }] });
  const deckBefore = attacker.deck.length;
  assert.equal(game.beginAttack(attacker.id, attack, { zone: "Mid" }), true);
  assert.equal(game.getPendingChoice()?.kind, "reaction");
  assert.equal(game.resolveChoice({ optionId: reaction.instanceId }), true);
  assert.equal(game.getPendingChoice()?.kind, "defense");
  assert.equal(game.resolveChoice({ optionId: "pass" }), true);
  assert.equal(attacker.turnStats.flowDrawUsed, true);
  assert.equal(attacker.deck.length, deckBefore - 1);
  assert.equal(game.telemetry.unsupportedEffects, 0);
});

test("batch simulation reports reproducible seeds and invariant results", async () => {
  const data = await loadGameData();
  const first = await simulateBatch({ games: 4, seedStart: 700, data });
  const second = await simulateBatch({ games: 4, seedStart: 700, data });
  assert.equal(first.successfulGames, 4);
  assert.equal(first.failedGames, 0);
  assert.deepEqual(first.seeds, [700, 701, 702, 703]);
  assert.equal(first.invariantFailures.length, 0);
  assert.deepEqual(first.telemetry, second.telemetry);
  assert.equal(first.unsupportedEffects, second.unsupportedEffects);
});

test("headless effect coverage is explicit and machine-reportable", async () => {
  const data = await loadGameData();
  const coverage = analyzeEffectCoverage(data.cardEffects, { catalog: data.cards, definition: data.definition });
  assert.equal(coverage.cardsWithEffects, 589);
  assert.ok(coverage.totalEffects > 0);
  assert.equal(coverage.totalEffects, coverage.supportedEffects + coverage.unsupportedEffects);
  assert.ok(coverage.unsupportedEffects > 0, "remaining unsupported classes must remain visible");
  assert.ok(Object.keys(coverage.unsupportedActions).length > 0 || Object.keys(coverage.unsupportedResolvers).length > 0);
  assert.equal(coverage.scopeCounts["baseline-core"] + coverage.scopeCounts["out-of-mode"], coverage.totalEffects);
  assert.equal(coverage.unsupportedByScope["baseline-core"], 123);
  assert.equal(coverage.unsupportedByScope["out-of-mode"], 106);
  assert.ok(Object.keys(coverage.topUnsupportedGroups).length > 0);
  assert.ok(coverage.cardsPartiallySupported.length > 0);
});
