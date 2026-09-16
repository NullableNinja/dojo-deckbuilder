import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { applyRuntimeCommands, createFamilyRuntimeState, runtimeStatusAmount } from "../app/family-effect-runtime.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
function card(id) {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
}
function commands(id, facts = {}, trigger = "onPlay") {
  return kataRuntimeCommandsForHost(card(id), trigger, facts);
}

test("conditional Katas execute canonical Focus, Speed, and draw effects from host facts", () => {
  assert.equal(commands("DDB-KAT-CORE-004", { belt: "Brown" }).find((c) => c.effect === "core.gainFocus")?.amount, 2);
  assert.equal(commands("DDB-KAT-CORE-004", { belt: "Green" }).length, 0);
  const offPeak = commands("DDB-KAT-CORE-041", { hasTempo: false });
  assert.equal(offPeak.find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(offPeak.find((c) => c.effect === "combat.modifySpeed")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-041", { hasTempo: true }).length, 0);
  assert.equal(commands("DDB-KAT-CORE-045", { firstCardPlayedThisTurn: true }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-052", { usedConsumableThisTurn: true }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-054", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.draw")?.amount, 1);
});

test("Recovery and Emergency healing run through the generic Kata command path", () => {
  assert.equal(commands("DDB-KAT-CORE-047", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.heal")?.amount, 3);
  assert.equal(commands("DDB-KAT-CORE-047", { wasHitSinceLastTurn: false }).some((c) => c.effect === "core.heal"), false);
  assert.equal(commands("DDB-KAT-CORE-014", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.heal")?.amount, 3);
});

test("Empty Hand Form arms a real next-Attack power status only when canonical conditions match", () => {
  const eligible = commands("DDB-KAT-CORE-016", { hasWeaponEquipped: false, firstAttackThisTurn: true });
  assert.deepEqual(eligible.map((c) => [c.effect, c.amount, c.duration]), [["combat.modifyAttackPower", 2, "nextAttack"]]);
  assert.equal(commands("DDB-KAT-CORE-016", { hasWeaponEquipped: true, firstAttackThisTurn: true }).length, 0);
  assert.equal(commands("DDB-KAT-CORE-016", { hasWeaponEquipped: false, firstAttackThisTurn: false }).length, 0);
  const state = applyRuntimeCommands(createFamilyRuntimeState(), eligible);
  assert.equal(runtimeStatusAmount(state, "nextAttack", "combat.modifyAttackPower"), 2);
});

test("Bassai Dai and Saifa arm next-Attack Piercing statuses", () => {
  const bassai = commands("DDB-KAT-CORE-003");
  const saifa = commands("DDB-KAT-CORE-049");
  assert.deepEqual(bassai.map((c) => [c.effect, c.amount, c.duration]), [["combat.piercing", 2, "nextAttack"]]);
  assert.deepEqual(saifa.map((c) => [c.effect, c.amount, c.duration]), [["combat.piercing", 1, "nextAttack"]]);
  const state = applyRuntimeCommands(createFamilyRuntimeState(), bassai);
  assert.equal(runtimeStatusAmount(state, "nextAttack", "combat.piercing"), 2);
});

test("persistent conditional Speed uses the shared runtime status model", () => {
  const offPeak = commands("DDB-KAT-CORE-041", { hasTempo: false });
  const state = applyRuntimeCommands(createFamilyRuntimeState(), offPeak);
  assert.equal(state.self.focus, 1);
  assert.equal(state.self.speed, 1);
  assert.equal(state.statuses.some((status) => status.effect === "combat.modifySpeed" && status.duration === "endOfRound"), true);
});

test("Quick Duel consumes generic Kata commands and Kata Piercing without card identity dispatch", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /kataRuntimeCommandsForHost\(card, timing, stage3cKataContext\(next, card\)\)/);
  assert.match(source, /stage3cAttackPiercing\(attacker, card, zone\)/);
  assert.match(source, /timing === "onPlay" && !isCoreKataCard\(card\)/);
  assert.doesNotMatch(source, /DDB-KAT-CORE-003|DDB-KAT-CORE-016|DDB-KAT-CORE-041|DDB-KAT-CORE-049/);
});
