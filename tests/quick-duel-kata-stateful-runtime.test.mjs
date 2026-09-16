import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { resolveNextDamagePreventionStatuses, expirePreventionAtNextInitiate } from "../app/structured-damage-prevention.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
const card = (id) => {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
};

test("Second Wind Form branches entirely from canonical hp facts", () => {
  const low = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-051"), "onPlay", { hpAtOrBelowHalfMax: true });
  assert.deepEqual(low.map((command) => [command.effect, command.amount, command.duration]), [["core.heal", 4, "immediate"]]);
  const high = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-051"), "onPlay", { hpAtOrBelowHalfMax: false });
  assert.deepEqual(high.map((command) => [command.effect, command.amount, command.duration]), [["combat.grantFlow", 0, "nextAttack"]]);
});

test("Margin-of-Error Meditation arms source-qualified prevention until next Initiate", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-037"), "onPlay", {});
  assert.equal(command.effect, "combat.preventDamage");
  assert.equal(command.amount, 2);
  assert.equal(command.duration, "nextDamage");
  assert.equal(command.qualifier?.source, "Attack");
  assert.equal(command.qualifier?.expires, "nextInitiate");
  assert.equal(command.qualifier?.gainFocusIfDamageAfterReduction, 0);
  assert.equal(command.qualifier?.focusAmount, 1);
});

test("Margin prevention grants Focus only when the watched Attack is reduced to zero", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-037"), "onPlay", {});
  const status = { sourceEffectId: command.sourceEffectId, effect: command.effect, target: "self", amount: command.amount, duration: command.duration, resolver: command.resolver, qualifier: command.qualifier, appliedImmediately: false };
  const zero = resolveNextDamagePreventionStatuses([status], 2, "Attack");
  assert.equal(zero.damage, 0);
  assert.equal(zero.focus, 1);
  assert.equal(zero.statuses.length, 0);
  const stillDamaged = resolveNextDamagePreventionStatuses([status], 5, "Attack");
  assert.equal(stillDamaged.damage, 3);
  assert.equal(stillDamaged.focus, 0);
});

test("Margin prevention ignores non-Attack damage and expires unused at next Initiate", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-037"), "onPlay", {});
  const status = { sourceEffectId: command.sourceEffectId, effect: command.effect, target: "self", amount: command.amount, duration: command.duration, resolver: command.resolver, qualifier: command.qualifier, appliedImmediately: false };
  const direct = resolveNextDamagePreventionStatuses([status], 2, "Direct");
  assert.equal(direct.damage, 2);
  assert.equal(direct.focus, 0);
  assert.equal(direct.statuses.length, 1);
  assert.equal(expirePreventionAtNextInitiate([status]).length, 0);
});

test("Quick Duel no longer hard-codes Second Wind and uses reusable prevention semantics", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /card\.name === "Second Wind Form"/);
  assert.match(source, /resolveNextDamagePreventionStatuses\(board\.stage3cStatuses \?\? \[\], damage, "Attack"\)/);
  assert.match(source, /expirePreventionAtNextInitiate\(next\.stage3cStatuses \?\? \[\]\)/);
});
