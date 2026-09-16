import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { applyRuntimeCommands, createFamilyRuntimeState } from "../app/family-effect-runtime.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const effects = JSON.parse(fs.readFileSync(new URL("../content/card-effects/katas.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
const card = (id) => {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
};

test("Jion and Sanchin canonical structured data modify fighter DEF, not card Guard", () => {
  for (const id of ["DDB-KAT-CORE-028", "DDB-KAT-CORE-050"]) {
    const effect = effects[id].effects.find((entry) => entry.resolver === "kata.defenseModifier");
    assert.equal(effect?.action, "modifyDefense", `${id} must modify fighter DEF`);
  }
});

test("Jion grants +1 DEF through end of round", () => {
  const commands = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-028"), "onPlay", {});
  assert.deepEqual(commands.map((command) => [command.effect, command.amount, command.duration]), [["combat.modifyDefense", 1, "endOfRound"]]);
  const state = applyRuntimeCommands(createFamilyRuntimeState(), commands);
  assert.equal(state.self.defense, 1);
  assert.equal(state.statuses.some((status) => status.effect === "combat.modifyDefense" && status.duration === "endOfRound"), true);
});

test("Sanchin maps its canonical start-of-next-turn duration to nextTurn DEF state", () => {
  const commands = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-050"), "onPlay", {});
  assert.deepEqual(commands.map((command) => [command.effect, command.amount, command.duration]), [["combat.modifyDefense", 2, "nextTurn"]]);
});

test("Jion Hide reward resolves only when no Attack was played", () => {
  const quiet = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-028"), "onHide", { playedAttackThisTurn: false });
  assert.deepEqual(quiet.map((command) => [command.effect, command.amount, command.duration]), [["core.gainFocus", 1, "immediate"]]);
  const attacked = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-028"), "onHide", { playedAttackThisTurn: true });
  assert.equal(attacked.length, 0);
});

test("Recovery Stance Hide heal requires both prior Hit and no Attack this turn", () => {
  const eligible = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-047"), "onHide", { wasHitSinceLastTurn: true, playedAttackThisTurn: false });
  assert.deepEqual(eligible.map((command) => [command.effect, command.amount, command.duration]), [["core.heal", 2, "immediate"]]);
  assert.equal(kataRuntimeCommandsForHost(card("DDB-KAT-CORE-047"), "onHide", { wasHitSinceLastTurn: false, playedAttackThisTurn: false }).length, 0);
  assert.equal(kataRuntimeCommandsForHost(card("DDB-KAT-CORE-047"), "onHide", { wasHitSinceLastTurn: true, playedAttackThisTurn: true }).length, 0);
});

test("Quick Duel executes generic Kata Hide effects for both fighters before cleanup", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /applyKataHideEffects\(hostedHide\.player, "player"\)/);
  assert.match(source, /applyKataHideEffects\(hostedHide\.ai, "ai"\)/);
  assert.doesNotMatch(source, /card\.name === "Jion"|card\.name === "Sanchin"|card\.name === "Recovery Stance"/);
});
