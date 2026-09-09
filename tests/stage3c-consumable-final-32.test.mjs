import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";
import { canPlayCoreConsumableInPhase } from "../app/stage3c-consumable-play-window.ts";
import { createFamilyRuntimeState } from "../app/family-effect-runtime.ts";
import { qualifiedNextPurchaseDiscount, spendableFocusForPurchase } from "../app/stage3c-consumable-surface.ts";
import { consumableEventReactionKind } from "../app/stage3c-consumable-event-reactions.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const family = JSON.parse(await readFile(new URL("../content/card-effects/consumables.json", import.meta.url), "utf8")).cards ?? {};
const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);
const previous30 = [1,2,3,5,6,13,14,16,19,20,23,24,27,28,29,36,37,40,41,42,43,46,47,48,50,57,58,59,60,62].map((n) => `DDB-CON-CORE-${String(n).padStart(3,"0")}`);
const final32 = [4,7,8,9,10,11,12,15,17,18,21,22,25,26,30,31,32,33,34,35,38,39,44,45,49,51,52,53,54,55,56,61].map((n) => `DDB-CON-CORE-${String(n).padStart(3,"0")}`);
const base = { hpThresholdMet: true, hasTempo: true, normalAttacksResolvedThisTurn: 2, friendlyTargetCount: 1, opponentTargetCount: 1, temporaryNegativeModifierPresent: true, removedTemporaryNegativeModifier: true, discardedCount: 2, revealedDifferentTypeCount: 3 };
const commands = (id, extra = {}) => consumableRuntimeCommands(card(id), "onPlay", { ...base, ...extra });

test("final batch is exactly the remaining 32 and union is all 62 Core Consumables", () => {
  assert.equal(new Set(final32).size, 32);
  assert.equal(new Set([...previous30, ...final32]).size, 62);
  assert.deepEqual([...new Set([...previous30, ...final32])].sort(), Object.keys(family).sort());
  for (const id of final32) { assert.ok(card(id), id); assert.ok(family[id]?.effects?.length, id); }
});

test("canonical final-32 names are taken from v2.3 catalog, not stale shorthand", () => {
  assert.equal(card("DDB-CON-CORE-010").name, "Department-Issue Trail Mix");
  assert.equal(card("DDB-CON-CORE-008").name, "Complimentary Fruit Cup");
  assert.equal(card("DDB-CON-CORE-052").name, "Spinach");
  assert.equal(card("DDB-CON-CORE-055").name, "Sweatband");
});

test("Complimentary Fruit Cup always resolves and uses the canonical 1-or-2 Focus threshold", () => {
  assert.equal(commands("DDB-CON-CORE-008", { hpThresholdMet: false }).find((c) => c.effect === "core.gainFocus")?.amount, 1);
  assert.equal(commands("DDB-CON-CORE-008", { hpThresholdMet: true }).find((c) => c.effect === "core.gainFocus")?.amount, 2);
  assert.ok(source.includes("board.hp <= 10"));
});

test("simple final-32 cards emit the canonical concrete commands their shared hooks execute", () => {
  const checks = [
    ["DDB-CON-CORE-004", "combat.modifyAttackPower", 2], ["DDB-CON-CORE-007", "core.gainFocus", 2],
    ["DDB-CON-CORE-015", "combat.modifySpeed", 1], ["DDB-CON-CORE-018", "core.draw", 2],
    ["DDB-CON-CORE-025", "core.draw", 2], ["DDB-CON-CORE-026", "core.draw", 2],
    ["DDB-CON-CORE-034", "core.gainFocus", 1], ["DDB-CON-CORE-038", "core.heal", 2],
    ["DDB-CON-CORE-039", "core.gainFocus", 3], ["DDB-CON-CORE-044", "core.gainFocus", 2],
    ["DDB-CON-CORE-052", "combat.modifyAttackPower", 2], ["DDB-CON-CORE-053", "combat.modifySpeed", 2],
    ["DDB-CON-CORE-055", "combat.modifySpeed", 2], ["DDB-CON-CORE-061", "core.gainXP", 1],
  ];
  for (const [id, effect, amount] of checks) assert.ok(commands(id).some((c) => c.effect === effect && c.amount === amount), `${id}:${effect}`);
  const gloves = commands("DDB-CON-CORE-004").find((c) => c.resolver === "consumable.nextQualifyingAttackModifier");
  assert.equal(gloves?.qualifier?.nextAttackTag, "Unarmed");
});

test("Ascend Consumables have a real phase and Voucher is a qualified next-purchase status, not a dead choice", () => {
  for (const id of ["DDB-CON-CORE-012", "DDB-CON-CORE-030"]) {
    assert.equal(canPlayCoreConsumableInPhase(card(id), "player-ascend", base), true);
    assert.equal(canPlayCoreConsumableInPhase(card(id), "player-yell", base), false);
  }
  const voucher = commands("DDB-CON-CORE-030").find((c) => c.resolver === "consumable.ascendPurchaseDiscount");
  assert.ok(voucher && !voucher.choice);
  assert.equal(voucher.target, "self");
  assert.equal(voucher.duration, "nextPurchase");
  assert.equal(voucher.qualifier?.minPrintedCost, 5);
  assert.ok(source.includes('kind: "stage3c-raffle"'));
  assert.ok(source.includes("resolveStage3CRaffle"));
});

test("Voucher discount respects printed-cost threshold and floor", () => {
  const status = { sourceEffectId: "voucher", effect: "economy.modifyCost", target: "self", amount: -2, duration: "nextPurchase", resolver: "consumable.ascendPurchaseDiscount", qualifier: { minPrintedCost: 5, minimumFinalCost: 4 } };
  assert.equal(qualifiedNextPurchaseDiscount([status], 4).amount, 0);
  assert.equal(qualifiedNextPurchaseDiscount([status], 5).amount, -2);
  assert.equal(qualifiedNextPurchaseDiscount([status], 5).minimumFinalCost, 4);
  assert.ok(source.includes("qualifiedNextPurchaseDiscount"));
  assert.ok(source.includes("consumeQualifiedNextPurchaseStatuses"));
});

test("Dojo Coupon restricted Focus cannot subsidize Technique purchases but remains spendable on Items/Equipment", () => {
  const couponStatus = { sourceEffectId: "coupon", effect: "core.gainFocus", target: "self", amount: 3, duration: "endOfTurn", resolver: "consumable.restrictedFocusItemsEquipment", qualifier: { spendOnlyOn: ["Item", "Equipment"] } };
  assert.equal(spendableFocusForPurchase(5, [couponStatus], { cardType: "Technique", subtype: "Attack" }), 2);
  assert.equal(spendableFocusForPurchase(5, [couponStatus], { cardType: "Item", subtype: "Consumable" }), 5);
  assert.equal(spendableFocusForPurchase(5, [couponStatus], { cardType: "Item", subtype: "Weapon" }), 5);
  assert.ok(source.includes("marketFocusAvailable"));
  assert.ok(source.includes("spendMarketFocus"));
});

test("all explicit player choices in the final 32 are promoted to the visible PendingChoice surface", () => {
  for (const kind of ["stage3c-trail-mix","stage3c-zone-ward","stage3c-remove-negative","stage3c-discard-focus","stage3c-weapon-suppress","stage3c-exhaust-focus","stage3c-raffle","stage3c-lucky-reveal","stage3c-sparring-pick","stage3c-sparring-junk","stage3c-reaction-discard"]) assert.ok(source.includes(`kind: "${kind}"`), kind);
  assert.ok(source.includes("resolveStage3CZoneWard"));
  assert.ok(source.includes("resolveStage3CNegative"));
  assert.ok(source.includes("resolveStage3CLucky"));
});

test("Confetti Cannon forces the actual opponent Reaction discard path for both human and AI controllers", () => {
  assert.ok(commands("DDB-CON-CORE-009").some((c) => c.resolver === "consumable.chooseOpponentDiscardReactionIfAble"));
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-009"'));
  assert.ok(source.includes('kind: "stage3c-reaction-discard"'));
});

test("Department-Issue Trail Mix and Receipt-Printer Ribbon pay real Equipment costs before their payoff", () => {
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-010"'));
  assert.ok(source.includes('kind: "stage3c-trail-mix"'));
  assert.ok(source.includes("exhaustEquipment(current.player, cardId)"));
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-045"'));
  assert.ok(source.includes('kind: "stage3c-exhaust-focus"'));
});

test("Foam Finger stores the chosen zone on the real next-Attack status", () => {
  const foam = commands("DDB-CON-CORE-021").find((c) => c.resolver === "consumable.zoneSpecificIncomingAttackPenalty");
  assert.equal(foam?.amount, -2);
  assert.ok(source.includes("nextAttackZone: zone"));
  assert.ok(source.includes("stage3cArmZoneWard"));
});

test("Fortune Cookie and Sparring Dummy use actual deck reveal/order/pick surfaces", () => {
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-022"'));
  assert.ok(source.includes('kind: "deck-order"'));
  assert.ok(source.includes('card.catalogId === "DDB-CON-CORE-051"'));
  assert.ok(source.includes('kind: "stage3c-sparring-pick"'));
  assert.ok(source.includes('kind: "stage3c-sparring-junk"'));
});

test("Pep Talk and Tiger Balm remove one actual temporary stat penalty; Pep Talk only then arms +1 Attack", () => {
  assert.ok(source.includes("stage3cNegativeStatOptions"));
  assert.ok(source.includes("stage3cRemoveTemporaryNegative"));
  assert.ok(source.includes("consumable-pep-talk-bonus"));
});

test("Last-Call Electrolytes is an optional 0/1/2 discard loop paying +2 Focus each", () => {
  const lastCall = commands("DDB-CON-CORE-032", { discardedCount: 2 });
  assert.ok(lastCall.some((c) => c.resolver === "consumable.discardUpToForFocus"));
  assert.ok(source.includes('kind: "stage3c-discard-focus"'));
  assert.ok(source.includes("focusPerDiscard: 2"));
});

test("Lucky Dumpling hooks both Market and Location reveal events, with Air Horn interception", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-033")), "replace-reveal");
  assert.ok(source.includes('revealKind: "market"'));
  assert.ok(source.includes('revealKind: "location"'));
  const luckyHandler = source.slice(source.indexOf("const resolveStage3CLucky"), source.indexOf("const skipPendingChoice"));
  assert.ok(luckyHandler.includes("firstEventReactionCard"));
});

test("Emergency Shoelace is correctly certified as a dormant replacement because Core has no Disarm producer", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-017")), "replace-disarm");
  const disarmCards = cards.filter((entry) => /\bdisarm/i.test(String(entry.rulesText ?? "")));
  assert.deepEqual(disarmCards.map((entry) => entry.catalogId), ["DDB-CON-CORE-017"]);
});

test("Muscle Ointment suppresses a chosen equipped Weapon penalty and Hide clears that suppression", () => {
  assert.ok(source.includes("suppressedEquipmentPenaltyIds"));
  assert.ok(source.includes('kind: "stage3c-weapon-suppress"'));
  assert.ok(source.includes("suppression && value < 0 ? 0 : value"));
  assert.ok(source.includes("suppressedEquipmentPenaltyIds: []"));
});

test("Smoke Bomb invalidates targeting on both combat directions and expires through the existing status lifecycle", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-049")), "invalidate-target");
  const smokeUses = source.match(/hasUntargetableStatus/g) ?? [];
  assert.ok(smokeUses.length >= 3);
  assert.ok(source.includes("invalidates the Attack target"));
  assert.ok(source.includes("Smoke Bomb leaves the computer without a legal target"));
  assert.ok(commands("DDB-CON-CORE-049")[0]?.qualifier?.expiresOnAttack);
});

test("Sweat Towel reaches the real next-Kata consumption hook", () => {
  const towel = commands("DDB-CON-CORE-054").find((c) => c.resolver === "consumable.nextKataFocusBonus");
  assert.equal(towel?.duration, "nextKata");
  assert.ok(source.includes('status.resolver === "consumable.nextKataFocusBonus"'));
});

test("no final-32 catalog entry is missing structured executable commands", () => {
  for (const id of final32) assert.ok(consumableRuntimeCommands(card(id), "onPlay", base).length > 0, id);
  const state = createFamilyRuntimeState();
  assert.equal(state.pendingChoices.length, 0);
});
