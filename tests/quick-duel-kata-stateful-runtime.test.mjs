import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kataEquipFromHandPlanForHost, kataRuntimeCommandsForHost } from "../app/kata-playtest-bridge.ts";
import { resolveNextDamagePreventionStatuses, expirePreventionAtNextInitiate } from "../app/structured-damage-prevention.ts";
import { consumeQualifiedNextComboLearnDiscount, consumeQualifiedNextPurchaseStatuses, qualifiedNextComboLearnDiscount, qualifiedNextPurchaseDiscount } from "../app/stage3c-consumable-surface.ts";

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

test("Ascend purchase-discount Katas become generic next-purchase statuses", () => {
  const coupon = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-013"), "onPlay", {});
  assert.deepEqual(coupon.map((command) => [command.effect, command.amount, command.duration, command.resolver]), [["economy.modifyCost", -1, "nextPurchase", "kata.purchaseDiscount"]]);
  assert.equal(coupon[0].qualifier?.minPrintedCost, 5);
  assert.equal(coupon[0].qualifier?.minimumFinalCost, 4);
  const status = { sourceEffectId: coupon[0].sourceEffectId, effect: coupon[0].effect, target: "self", amount: coupon[0].amount, duration: coupon[0].duration, resolver: "consumable.ascendPurchaseDiscount", qualifier: coupon[0].qualifier, appliedImmediately: false };
  const eligible = { cardType: "Attack", fpCost: 6 };
  assert.deepEqual(qualifiedNextPurchaseDiscount([status], 6, eligible, []), { amount: -1, minimumFinalCost: 4, sourceEffectId: status.sourceEffectId });
  assert.equal(consumeQualifiedNextPurchaseStatuses([status], 4, { cardType: "Attack", fpCost: 4 }, []).length, 1);
  assert.equal(consumeQualifiedNextPurchaseStatuses([status], 6, eligible, []).length, 0);
});

test("Compliance Shopping List keeps its first-novel-card-type qualifier", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-012"), "onPlay", { belt: "Purple" });
  const status = { sourceEffectId: command.sourceEffectId, effect: command.effect, target: "self", amount: command.amount, duration: command.duration, resolver: "consumable.ascendPurchaseDiscount", qualifier: command.qualifier, appliedImmediately: false };
  assert.equal(qualifiedNextPurchaseDiscount([status], 2, { cardType: "Attack" }, ["Attack"]).sourceEffectId, null);
  assert.equal(qualifiedNextPurchaseDiscount([status], 2, { cardType: "Defense" }, ["Attack"]).amount, -1);
});

test("Seipai arms and consumes a generic next-Combo learn discount", () => {
  const [command] = kataRuntimeCommandsForHost(card("DDB-KAT-CORE-053"), "onPlay", {});
  assert.deepEqual([command.effect, command.amount, command.duration, command.resolver], ["economy.modifyCost", -1, "nextComboLearn", "kata.comboDiscount"]);
  const status = { sourceEffectId: command.sourceEffectId, effect: command.effect, target: "self", amount: command.amount, duration: command.duration, resolver: command.resolver, qualifier: command.qualifier, appliedImmediately: false };
  assert.deepEqual(qualifiedNextComboLearnDiscount([status]), { amount: 1, sourceEffectId: status.sourceEffectId });
  assert.equal(consumeQualifiedNextComboLearnDiscount([status]).length, 0);
});

test("Equipment-from-hand Katas expose generic equip choices with canonical qualifiers", () => {
  const provisional = kataEquipFromHandPlanForHost(card("DDB-KAT-CORE-046"));
  assert.deepEqual(provisional, { family: "Item", subtype: "Gear", ready: true, nextAttackPower: 1, additionalFocus: 0 });
  const familiarization = kataEquipFromHandPlanForHost(card("DDB-KAT-CORE-061"));
  assert.deepEqual(familiarization, { family: "Equipment", subtype: undefined, ready: false, nextAttackPower: 0, additionalFocus: 1 });
});
