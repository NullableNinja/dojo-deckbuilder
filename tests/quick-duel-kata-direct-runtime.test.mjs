import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataDirectRuntimeCommands } from "../app/kata-runtime-adapter.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
function card(id) { const found = byCatalog.get(id); assert.ok(found, `missing ${id}`); return found; }
function commands(id, trigger, facts = {}) { return kataDirectRuntimeCommands(card(id), trigger, facts); }

test("Black-Belt Budget Hearing honors the canonical Brown-belt threshold", () => {
  assert.equal(commands("DDB-KAT-CORE-004", "onPlay", { belt: "Brown" }).find((c) => c.effect === "core.gainFocus")?.amount, 2);
  assert.equal(commands("DDB-KAT-CORE-004", "onPlay", { belt: "Red" }).some((c) => c.effect === "core.gainFocus"), false);
});

test("Closing-Time Concentration reads Market size from host facts", () => {
  assert.equal(commands("DDB-KAT-CORE-011", "onPlay", { marketCardsRemaining: 5 }).some((c) => c.effect === "core.gainFocus" && c.amount === 1), true);
  assert.equal(commands("DDB-KAT-CORE-011", "onPlay", { marketCardsRemaining: 4 }).length, 0);
});

test("Emergency Breathing Memorandum conditional heal is executable", () => {
  assert.equal(commands("DDB-KAT-CORE-014", "onPlay", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.heal")?.amount, 3);
  assert.equal(commands("DDB-KAT-CORE-014", "onPlay", { wasHitSinceLastTurn: false }).some((c) => c.effect === "core.heal"), false);
});

test("Footwork Drill resolves fastest Focus after its Speed modifier has been applied", () => {
  assert.equal(commands("DDB-KAT-CORE-021", "afterResolve", { isFastest: true }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-021", "afterResolve", { isFastest: false }).length, 0);
});

test("Off-Peak Enlightenment emits both Focus and standing Speed only without Tempo", () => {
  const noTempo = commands("DDB-KAT-CORE-041", "onPlay", { hasTempo: false });
  assert.equal(noTempo.find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(noTempo.find((c) => c.effect === "combat.modifySpeed")?.duration, "endOfRound");
  assert.equal(commands("DDB-KAT-CORE-041", "onPlay", { hasTempo: true }).length, 0);
});

test("Pocket-Change Breathing only grants its extra Focus as the first card played", () => {
  assert.equal(commands("DDB-KAT-CORE-045", "onPlay", { firstCardPlayedThisTurn: true }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-045", "onPlay", { firstCardPlayedThisTurn: false }).length, 0);
});

test("Recovery Stance and Seisan use the was-Hit fact", () => {
  assert.equal(commands("DDB-KAT-CORE-047", "onPlay", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.heal")?.amount, 3);
  assert.equal(commands("DDB-KAT-CORE-054", "onPlay", { wasHitSinceLastTurn: true }).find((c) => c.effect === "core.draw")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-054", "onPlay", { wasHitSinceLastTurn: false }).length, 0);
});

test("Second-Cup Centering keys off Consumable use this turn", () => {
  assert.equal(commands("DDB-KAT-CORE-052", "onPlay", { usedConsumableThisTurn: true }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-KAT-CORE-052", "onPlay", { usedConsumableThisTurn: false }).length, 0);
});

test("Second Wind Form branches between heal and Flow", () => {
  const low = commands("DDB-KAT-CORE-051", "onPlay", { hpAtOrBelowHalfMax: true });
  assert.equal(low.find((c) => c.effect === "core.heal")?.amount, 4);
  assert.equal(low.some((c) => c.effect === "combat.grantFlow"), false);
  const high = commands("DDB-KAT-CORE-051", "onPlay", { hpAtOrBelowHalfMax: false });
  assert.equal(high.some((c) => c.effect === "core.heal"), false);
  assert.equal(high.find((c) => c.effect === "combat.grantFlow")?.duration, "nextAttack");
});

test("Breakroom Mobility branch arms Guard when fastest or Any-zone when not fastest", () => {
  const fast = commands("DDB-KAT-CORE-006", "afterResolve", { isFastest: true, firstAttackThisTurn: true });
  assert.equal(fast.find((c) => c.effect === "combat.modifyGuard")?.duration, "nextDefense");
  assert.equal(fast.some((c) => c.effect === "combat.chooseZone"), false);
  const slow = commands("DDB-KAT-CORE-006", "afterResolve", { isFastest: false, firstAttackThisTurn: true });
  assert.equal(slow.some((c) => c.effect === "combat.chooseZone"), true);
  assert.equal(commands("DDB-KAT-CORE-006", "afterResolve", { isFastest: false, firstAttackThisTurn: false }).some((c) => c.effect === "combat.chooseZone"), false);
});

test("Breath Control and Tekki Shodan produce structured Flow statuses", () => {
  assert.equal(commands("DDB-KAT-CORE-007", "onPlay").find((c) => c.effect === "combat.grantFlow")?.duration, "nextAttack");
  const tekki = commands("DDB-KAT-CORE-057", "onPlay").find((c) => c.effect === "combat.grantFlow");
  assert.deepEqual(tekki?.qualifier?.attackZones, ["Low", "Mid"]);
});

test("Heian Shodan grants the next Attack a generic Any-zone declaration", () => {
  const heian = commands("DDB-KAT-CORE-026", "onPlay", { firstAttackThisTurn: true }).find((c) => c.effect === "combat.chooseZone");
  assert.ok(heian);
});
