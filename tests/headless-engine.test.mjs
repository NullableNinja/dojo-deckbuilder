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

test("belt promotion requires the canonical XP and completed exam", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 1201 });
  const player = game.players[0];
  game.phase = "Ascend";
  game.activePlayer = player.id;
  player.xp = data.definition.progression.belts[1].xp;
  assert.equal(game.canPromote(player), false);
  assert.equal(game.applyAction({ type: "promote", playerId: player.id }), false);

  player.completedTasks.push(1);
  assert.ok(game.getLegalActions(player.id).some((action) => action.type === "promote"));
  assert.equal(game.applyAction({ type: "promote", playerId: player.id }), true);
  assert.equal(player.beltIndex, 1);
  assert.equal(player.promotionHistory[0].from, 0);
  assert.equal(player.promotionHistory[0].to, 1);
  assert.equal(game.telemetry.promotions, 1);
});

test("training stripe recovery obeys the canonical once-per-turn action limit", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 1202 });
  const player = game.players[0];
  game.phase = "Ascend";
  game.activePlayer = player.id;
  player.hp = player.maxHp - 5;
  player.trainingStripes = { held: 3, awarded: 3, provisional: false, spentTurnKey: null, spendsThisTurn: 0 };
  assert.equal(game.applyAction({ type: "recover-training-stripe", playerId: player.id }), true);
  assert.equal(game.applyAction({ type: "recover-training-stripe", playerId: player.id }), false);
  assert.equal(player.trainingStripes.held, 2);
});

test("round-limit results report the completed canonical round", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 12025 });
  game.definition.mode.maxRounds = 1;
  for (const player of game.players) {
    player.hp = 1000;
    player.maxHp = 1000;
    player.atk = 0;
    player.def = 1000;
  }
  const result = game.run();
  assert.equal(result.reason, "round-limit");
  assert.equal(result.rounds, 1);
});

test("AI-facing Combo acquisition and execution use canonical definitions", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 1203 });
  const player = game.players[0];
  game.phase = "Ascend";
  game.activePlayer = player.id;
  player.focus = 10;
  player.comboOffered = game.cardInstance(data.byId.get("DDB-CMB-CORE-001"));
  assert.ok(game.getLegalActions(player.id).some((action) => action.type === "learn-combo"));
  assert.equal(game.applyAction({ type: "learn-combo", playerId: player.id, cardId: player.comboOffered.instanceId }), true);
  assert.deepEqual(player.learnedCombos.map((card) => card.catalogId), ["DDB-CMB-CORE-001"]);
  assert.equal(game.telemetry.comboAcquisitions, 1);

  const kata = data.cards.find((card) => card.subtype === "Kata");
  const attack = data.cards.find((card) => card.subtype === "Attack");
  const previousAttack = data.cards.find((card) => card.subtype === "Attack" && card.catalogId !== attack.catalogId);
  player.comboFacts.turnPlayed = [{ cardId: kata.catalogId, zone: "High" }];
  player.comboFacts.turnAttacks = [{ cardId: previousAttack.catalogId, zone: "High", hit: true }];
  const currentAttack = game.cardInstance(attack);
  const activated = game.activateCombos(player, "onAttackDeclared", currentAttack, "Mid", { currentAttackHit: false });
  assert.deepEqual(activated, ["DDB-CMB-CORE-001"]);
  assert.equal(game.telemetry.comboActivations, 1);
  assert.equal(player.comboTriggeredThisGame, true);
  assert.equal(game.telemetry.unsupportedEffects, 0);
});

test("locked initiative order gives both living players a turn before the next Honor", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 42, strategies: ["economy", "aggression"] });
  const seenPlayers = new Set();
  const policy = {
    chooseAction(current, legal) {
      seenPlayers.add(current.activePlayer);
      return current.defaultAction(legal);
    },
    chooseChoice(current) {
      seenPlayers.add(current.pendingChoice?.playerId ?? current.activePlayer);
      return current.defaultChoice();
    },
  };
  const result = game.run({ policy });
  assert.deepEqual([...seenPlayers].sort(), [0, 1]);
  assert.ok(result.turns >= 2);
  assert.equal(result.invariantFailures.length, 0);
});

test("while-equipped equipment modifiers do not accumulate across combat events", async () => {
  const data = await loadGameData();
  const result = new Game(data, { seed: 9093, strategies: ["balanced", "fortress"] }).run();
  const trafficConeStatuses = result.state.players
    .flatMap((player) => player.statuses)
    .filter((status) => status.sourceId?.startsWith("DDB-WPN-CORE-063#"));
  assert.ok(trafficConeStatuses.length <= 1);
  assert.ok(result.telemetry.damagePrevented < 10000);
  assert.equal(result.invariantFailures.length, 0);
});

test("market legal actions include active purchase penalties", async () => {
  const data = await loadGameData();
  const result = new Game(data, { seed: 12001, strategies: ["balanced", "balanced"] }).run();
  assert.equal(result.invariantFailures.length, 0);
  assert.equal(result.unsupportedEffects, 0);
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

test("status identifiers remain unique after a status is removed", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 107 });
  const player = game.players[0];
  game.addStatus(player, { action: "modifyDefense", amount: 1, duration: "nextHonor" });
  const firstId = player.statuses[0].id;
  assert.equal(game.removeStatus(player, "modifyDefense"), true);
  game.addStatus(player, { action: "modifyDefense", amount: 1, duration: "nextHonor" });
  game.addStatus(player, { action: "modifyDefense", amount: 1, duration: "nextHonor" });
  assert.equal(new Set(player.statuses.map((status) => status.id)).size, 2);
  assert.notEqual(player.statuses[0].id, firstId);
  assert.equal(game.checkInvariants().length, 0);
});

test("terminal games do not retain an unresolved choice", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 9, strategies: ["balanced", "balanced"] });
  const result = game.run();
  assert.equal(result.reason, "knockout");
  assert.equal(result.state.pendingChoice, null);
  assert.equal(result.invariantFailures.length, 0);
});

test("Character Initiate Consumable cycling is a resumable headless choice", async () => {
  const data = await loadGameData();
  const bento = data.cards.find((card) => card.catalogId === "DDB-CHR-CORE-023");
  const game = new Game(data, { seed: 108, characters: [bento, data.cards.find((card) => card.cardType === "Character" && card.catalogId !== bento.catalogId)] });
  game.advanceAutomaticEvents();
  const player = game.players[game.activePlayer];
  const consumable = game.cardInstance(data.cards.find((card) => card.subtype === "Consumable"));
  player.hand = [consumable];
  player.deck = [game.cardInstance(data.cards.find((card) => card.catalogId === "DDB-STA-CORE-002"))];
  assert.equal(game.applyAction({ type: "pass", playerId: player.id }), true);
  assert.equal(game.getPendingChoice()?.kind, "cycle-discard-draw");
  assert.equal(game.getPendingChoice()?.options.some((option) => option.id === consumable.instanceId), true);
  assert.equal(game.resolveChoice({ optionId: consumable.instanceId }), true);
  assert.equal(player.discard.includes(consumable), true);
});

test("Character Junk discard replacement exposes destroy-or-keep and Green follow-up", async () => {
  const data = await loadGameData();
  const panda = data.cards.find((card) => card.catalogId === "DDB-CHR-CORE-015");
  const game = new Game(data, { seed: 109, characters: [panda, data.cards.find((card) => card.cardType === "Character" && card.catalogId !== panda.catalogId)] });
  const player = game.players[0];
  const junk = game.cardInstance(data.cards.find((card) => card.category === "Junk"));
  player.hand = [junk];
  assert.equal(game.discardCard(player, junk), true);
  assert.equal(game.getPendingChoice()?.kind, "discard-or-destroy");
  assert.equal(game.resolveChoice({ optionId: "destroy" }), true);
  assert.equal(player.destroyed.includes(junk), true);
  assert.equal(game.getPendingChoice()?.kind, "card-movement");
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
  assert.equal(coverage.unsupportedEffects, 0, "all canonical structured effects now have a headless execution contract");
  assert.equal(Object.keys(coverage.unsupportedActions).length, 0);
  assert.equal(Object.keys(coverage.unsupportedResolvers).length, 0);
  assert.equal(coverage.scopeCounts["baseline-core"] + coverage.scopeCounts["out-of-mode"], coverage.totalEffects);
  assert.equal(coverage.unsupportedByScope["baseline-core"] ?? 0, 0);
  assert.equal(coverage.unsupportedByScope["out-of-mode"] ?? 0, 0);
  assert.equal(Object.keys(coverage.topUnsupportedGroups).length, 0);
  assert.equal(coverage.cardsPartiallySupported.length, 0);
});
