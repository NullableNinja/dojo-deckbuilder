import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aiDefensiveConsumableScore, chooseAiDefensiveConsumable } from "../app/stage3c-consumable-reaction-ai.ts";
import { consumableEventReactionKind, hasUntargetableStatus } from "../app/stage3c-consumable-event-reactions.ts";
import { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);

test("event-driven Consumables are classified by the engine event they intercept", () => {
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-001")), "cancel-reaction");
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-017")), "replace-disarm");
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-033")), "replace-reveal");
  assert.equal(consumableEventReactionKind(card("DDB-CON-CORE-049")), "invalidate-target");
});

test("Smoke Bomb emits an untargetable next-turn status with early Attack expiry", () => {
  const command = consumableRuntimeCommands(card("DDB-CON-CORE-049"), "onPlay").find((entry) => entry.qualifier?.untargetable === true);
  assert.ok(command);
  assert.equal(command.duration, "nextTurn");
  assert.equal(command.qualifier?.expiresOnAttack, true);
  assert.equal(hasUntargetableStatus([{ sourceEffectId: "smoke", effect: "core.custom", target: "self", amount: 0, duration: "nextTurn", qualifier: command.qualifier }]), true);
});

test("AI considers the five mitigation Reactions plus Smoke Bomb as legal incoming-Attack candidates", () => {
  for (const catalogId of ["DDB-CON-CORE-005", "DDB-CON-CORE-016", "DDB-CON-CORE-036", "DDB-CON-CORE-041", "DDB-CON-CORE-047", "DDB-CON-CORE-049"]) {
    assert.ok(aiDefensiveConsumableScore(card(catalogId), { missingHp: 5, expectedIncomingDamage: 4, friendlyTargetCount: 1, opponentTargetCount: 1 }) > 0, catalogId);
  }
});

test("AI keeps unrelated event-specific Reactions out of the incoming-Attack defensive window", () => {
  for (const catalogId of ["DDB-CON-CORE-001", "DDB-CON-CORE-017", "DDB-CON-CORE-033"]) {
    assert.equal(aiDefensiveConsumableScore(card(catalogId), { missingHp: 5, expectedIncomingDamage: 4 }), Number.NEGATIVE_INFINITY, catalogId);
  }
});

test("AI deterministically prioritizes Smoke Bomb when it can invalidate the target", () => {
  const hand = [card("DDB-CON-CORE-016"), card("DDB-CON-CORE-005"), card("DDB-CON-CORE-041"), card("DDB-CON-CORE-049")];
  const selected = chooseAiDefensiveConsumable(hand, { missingHp: 0, expectedIncomingDamage: 4, friendlyTargetCount: 1, opponentTargetCount: 1 });
  assert.equal(selected?.catalogId, "DDB-CON-CORE-049");
});

test("AI passes instead of wasting a defensive Consumable when no legal card has positive value", () => {
  const hand = [card("DDB-CON-CORE-001"), card("DDB-CON-CORE-017"), card("DDB-CON-CORE-033")];
  assert.equal(chooseAiDefensiveConsumable(hand, { missingHp: 0, expectedIncomingDamage: 0, friendlyTargetCount: 1, opponentTargetCount: 1 }), null);
});
