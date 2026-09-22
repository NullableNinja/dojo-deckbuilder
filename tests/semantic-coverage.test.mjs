import test from "node:test";
import assert from "node:assert/strict";
import { analyzeEffectCoverage } from "../engine/coverage.mjs";
import { Game } from "../engine/core.mjs";
import { loadGameData } from "../engine/rules-loader.mjs";

test("coverage rejects an unknown family resolver instead of treating it as structured", () => {
  const report = analyzeEffectCoverage({ cards: { FIXTURE: { effects: [{ id: "fixture", action: "custom", effect: "core.custom", resolver: "kata.notRegistered" }] } } }, {
    catalog: [{ catalogId: "FIXTURE", cardType: "Starter" }],
    definition: { starterDeck: [], economy: { market: { decks: [] } } },
  });
  assert.equal(report.semanticallyExecutableEffects, 0);
  assert.equal(report.unsupportedEffects, 1);
  assert.equal(report.unsupportedResolvers["kata.notRegistered"], 1);
});

test("runtime rejects an unknown family resolver without mutating the game", async () => {
  const data = await loadGameData();
  const game = new Game(data, { seed: 9917 });
  const player = game.players[0];
  const card = { ...data.cards.find((candidate) => candidate.cardType === "Character"), instanceId: "fixture-character" };
  const before = structuredClone(game.getState());
  game.applyCardEffects(player, card, "passive", {
    opponent: game.players[1],
    sourceCard: card,
    effectOverride: [{ id: "fixture-unknown", action: "custom", effect: "core.custom", resolver: "reaction.notRegistered" }],
  });
  assert.equal(game.telemetry.unsupportedEffects, 1);
  const after = game.getState();
  assert.equal(after.players[0].focus, before.players[0].focus);
  assert.equal(after.players[0].hp, before.players[0].hp);
  assert.equal(after.players[0].statuses.length, before.players[0].statuses.length);
});

test("canonical baseline coverage has no semantically unsupported entries", async () => {
  const data = await loadGameData();
  const report = analyzeEffectCoverage(data.cardEffects, { catalog: data.cards, definition: data.definition });
  assert.equal(report.totalEffects, 907);
  assert.equal(report.staticallyRecognizedEffects, 907);
  assert.equal(report.semanticallyExecutableEffects, 907);
  assert.equal(report.unsupportedEffects, 0);
  assert.equal(report.unsupportedByScope["baseline-core"] ?? 0, 0);
});
