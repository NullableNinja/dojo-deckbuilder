import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { applyRuntimeCommands, createFamilyRuntimeState } from "../app/family-effect-runtime.ts";
import { consumeNextDefenseStatuses, nextDefenseGuardBonus } from "../app/stage3c-defense-status-semantics.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
const card = (id) => {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
};

test("Breakroom Box Breathing arms a qualified next-Defense Guard watcher", () => {
  const commands = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-005"), "onPlay", {});
  assert.equal(commands.length, 1);
  const [command] = commands;
  assert.equal(command.effect, "combat.modifyGuard");
  assert.equal(command.amount, 1);
  assert.equal(command.duration, "nextDefense");
  assert.equal(command.qualifier?.firstDefenseThisRound, true);
  assert.equal(command.qualifier?.boughtCardThisTurn, false);
  assert.equal(command.qualifier?.expires, "endOfRound");
});

test("Breakroom watcher grants Guard only to the first Defense after a no-purchase turn", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-005"), "onPlay", {});
  const state = applyRuntimeCommands(createFamilyRuntimeState(), [command]);
  assert.equal(state.statuses.length, 1);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: true, boughtCardThisTurn: false }), 1);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: true, boughtCardThisTurn: true }), 0);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: false, boughtCardThisTurn: false }), 0);
});

test("unqualified next-Defense Guard statuses remain backward-compatible", () => {
  const statuses = [{
    sourceEffectId: "existing-next-defense",
    effect: "combat.modifyGuard",
    target: "self",
    amount: 2,
    duration: "nextDefense",
    appliedImmediately: false,
  }];
  assert.equal(nextDefenseGuardBonus(statuses, { firstDefenseThisRound: false, boughtCardThisTurn: true }), 2);
});

test("the first Defense consumes the watcher even when its purchase condition failed", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-005"), "onPlay", {});
  const state = applyRuntimeCommands(createFamilyRuntimeState(), [command]);
  assert.equal(nextDefenseGuardBonus(state.statuses, { firstDefenseThisRound: true, boughtCardThisTurn: true }), 0);
  assert.equal(consumeNextDefenseStatuses(state.statuses).length, 0);
});

test("Quick Duel derives Breakroom qualification from generic board state", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /firstDefenseThisRound: !board\.defendedThisRound/);
  assert.match(source, /boughtCardThisTurn: Boolean\(board\.boughtCardLastAscend\)/);
  assert.doesNotMatch(source, /card\.name === "Breakroom Box Breathing"|DDB-KAT-CORE-005/);
});
