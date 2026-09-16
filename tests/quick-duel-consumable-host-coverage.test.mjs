import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";
import { armConsumableHideStatuses, resolveConsumableHideStatuses } from "../app/stage3c-consumable-hide-followup.ts";
import { armConsumableAttackFollowupStatuses, resolveConsumableAttackFollowupStatuses } from "../app/stage3c-consumable-attack-followup.ts";
import { consumableEventReactionKind } from "../app/stage3c-consumable-event-reactions.ts";
import { structuredConsumableTopRevealPlan } from "../app/stage3c-consumable-reveal.ts";
import { chooseAiTemporaryStatusRemoval, removableTemporaryStatuses, removeTemporaryStatus } from "../app/stage3c-consumable-status-removal.ts";
import { qualifiedNextPurchaseDiscount, spendableFocusForPurchase } from "../app/stage3c-consumable-surface.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byCatalog = new Map(cards.map((entry) => [entry.catalogId, entry]));
function card(id) {
  const found = byCatalog.get(id);
  assert.ok(found, `missing canonical card ${id}`);
  return found;
}

const solo = { friendlyTargetCount: 1, opponentTargetCount: 1 };

test("Complimentary Fruit Cup uses the canonical HP threshold", () => {
  const fruit = card("DDB-CON-CORE-008");
  const low = consumableRuntimeCommands(fruit, "onPlay", { ...solo, hpThresholdMet: true }).find((c) => c.effect === "core.gainFocus");
  const high = consumableRuntimeCommands(fruit, "onPlay", { ...solo, hpThresholdMet: false }).find((c) => c.effect === "core.gainFocus");
  assert.equal(low?.amount, 2);
  assert.equal(high?.amount, 1);
});

test("Instant Noodles draws only when the post-play hand is empty", () => {
  const noodles = card("DDB-CON-CORE-028");
  assert.equal(consumableRuntimeCommands(noodles, "onPlay", { ...solo, handEmptyAfterHeal: true }).some((c) => c.effect === "core.draw"), true);
  assert.equal(consumableRuntimeCommands(noodles, "onPlay", { ...solo, handEmptyAfterHeal: false }).some((c) => c.effect === "core.draw"), false);
});

test("Muscle Relaxant creates both damage prevention and an attack lock", () => {
  const commands = consumableRuntimeCommands(card("DDB-CON-CORE-036"), "onPlay", solo);
  const prevent = commands.find((c) => c.effect === "combat.preventDamage");
  const lock = commands.find((c) => c.resolver === "consumable.preventAttackUntilNextTurn");
  assert.equal(prevent?.amount, 2);
  assert.equal(prevent?.duration, "nextDamage");
  assert.equal(lock?.duration, "nextTurn");
  assert.equal(lock?.qualifier?.restriction, "attack");
});

test("Warranty-Approved Ice Pop applies its conditional healing and Consumable lockout", () => {
  const pop = card("DDB-CON-CORE-058");
  const normal = consumableRuntimeCommands(pop, "onPlay", { ...solo, reactionItemUsedSinceLastTurn: false });
  const bonus = consumableRuntimeCommands(pop, "onPlay", { ...solo, reactionItemUsedSinceLastTurn: true });
  assert.equal(normal.filter((c) => c.effect === "core.heal").reduce((n, c) => n + c.amount, 0), 4);
  assert.equal(bonus.filter((c) => c.effect === "core.heal").reduce((n, c) => n + c.amount, 0), 6);
  assert.equal(bonus.find((c) => c.resolver === "consumable.warrantyIcePop" && c.effect === "core.custom")?.qualifier?.restriction, "consumable");
});

test("Overtime Espresso resolves Tempo cycle and Hide self-damage through live followup helpers", () => {
  const espresso = card("DDB-CON-CORE-040");
  const tempo = consumableRuntimeCommands(espresso, "onPlay", { ...solo, hasTempo: true });
  const noTempo = consumableRuntimeCommands(espresso, "onPlay", { ...solo, hasTempo: false });
  assert.equal(tempo.some((c) => c.effect === "core.draw"), true);
  assert.equal(tempo.some((c) => c.effect === "core.discard"), true);
  assert.equal(noTempo.some((c) => c.effect === "core.draw" || c.effect === "core.discard"), false);
  const armed = armConsumableHideStatuses([], espresso);
  const resolved = resolveConsumableHideStatuses(armed);
  assert.equal(resolved.directSelfDamage, 1);
});

test("Mystery Dojo Jerky and Pocket Yoyo passive watchers resolve after the watched Attack", () => {
  const jerky = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-037"));
  assert.equal(resolveConsumableAttackFollowupStatuses(jerky, { blocked: true }).directSelfDamage, 1);
  const yoyo = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-062"));
  assert.equal(resolveConsumableAttackFollowupStatuses(yoyo, { blocked: true }).focus, 1);
});

test("Fine-Print Fortune Cookie exposes an explicit top-deck reveal plan", () => {
  assert.deepEqual(structuredConsumableTopRevealPlan(card("DDB-CON-CORE-020")), { count: 1, resolver: "consumable.revealTopFocusValue" });
});

test("Spare Wrap removal can remove a queued status and reverse an already-applied temporary modifier", () => {
  const queued = { sourceEffectId: "penalty-next-attack", effect: "combat.modifyAttackPower", target: "self", amount: -2, duration: "nextAttack", resolver: "test.penalty", qualifier: { nextAttack: true }, appliedImmediately: false };
  const speed = { sourceEffectId: "penalty-speed", effect: "combat.modifySpeed", target: "self", amount: -2, duration: "endOfRound", resolver: "test.speed", appliedImmediately: true };
  const restriction = { sourceEffectId: "attack-lock", effect: "core.custom", target: "self", amount: 0, duration: "nextTurn", resolver: "test.lock", qualifier: { restriction: "attack" }, appliedImmediately: false };
  const board = { stage3cStatuses: [queued, speed, restriction], stage3cRestrictions: ["attack"], tempSpeed: -2, stage3cAttackModifier: 0, stage3cDefenseModifier: 0, stage3cSpeedOverride: null, stage3cPurchaseCostModifier: 0 };
  assert.equal(removableTemporaryStatuses(board.stage3cStatuses).length, 3);
  assert.equal(chooseAiTemporaryStatusRemoval(board.stage3cStatuses), queued.sourceEffectId);
  const afterSpeed = removeTemporaryStatus(board, speed.sourceEffectId).board;
  assert.equal(afterSpeed.tempSpeed, 0);
  assert.equal(afterSpeed.stage3cStatuses.some((s) => s.sourceEffectId === speed.sourceEffectId), false);
  const afterRestriction = removeTemporaryStatus(board, restriction.sourceEffectId).board;
  assert.equal(afterRestriction.stage3cRestrictions.includes("attack"), false);
});

test("Emergency Shoelace is recognized as a Disarm replacement Reaction", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-017")), "replace-disarm");
});

test("Dojo Coupon and Lunch Voucher have purchase-time consumers", () => {
  const coupon = consumableRuntimeCommands(card("DDB-CON-CORE-011"), "onPlay", solo).find((c) => c.resolver === "consumable.restrictedFocusItemsEquipment");
  assert.ok(coupon);
  const weapon = cards.find((entry) => entry.cardType === "Item" && /weapon/i.test(String(entry.subtype ?? ""))) ?? { cardType: "Item", subtype: "Weapon" };
  assert.equal(spendableFocusForPurchase(5, [{ sourceEffectId: coupon.sourceEffectId, effect: coupon.effect, target: "self", amount: coupon.amount, duration: coupon.duration, resolver: coupon.resolver, qualifier: coupon.qualifier, appliedImmediately: false }], weapon), 5);

  const voucher = consumableRuntimeCommands(card("DDB-CON-CORE-030"), "onPlay", solo).find((c) => c.resolver === "consumable.ascendPurchaseDiscount");
  assert.ok(voucher);
  const discount = qualifiedNextPurchaseDiscount([{ sourceEffectId: voucher.sourceEffectId, effect: voucher.effect, target: "self", amount: voucher.amount, duration: voucher.duration, resolver: voucher.resolver, qualifier: voucher.qualifier, appliedImmediately: false }], 5);
  assert.equal(discount.amount, -2);
  assert.equal(discount.minimumFinalCost, 4);
});

test("Quick Duel has live consumers for attack/consumable restrictions and the Spare Wrap continuation", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /stage3cRestrictionBlocks\(current\.player\.stage3cRestrictions, "attack"\)/);
  assert.match(source, /stage3cRestrictionBlocks\(player\.stage3cRestrictions, "consumable"\)/);
  assert.match(source, /consumable\.healAndRemoveStatus/);
  assert.match(source, /kind: "stage3c-remove-status"/);
  assert.match(source, /structuredConsumableTopRevealPlan\(card\)/);
});
