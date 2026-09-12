import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  kataCommandsForHost,
  kataDeckLookPlanForHost,
  kataDestroyPlanForHost,
  kataDiscardFollowupForHost,
  kataFastestFocusForHost,
  kataMandatoryDiscardCountForHost,
  kataNextAttackAnyZoneForHost,
  kataNextAttackFlowForHost,
} from "../app/kata-playtest-bridge.ts";
import {
  conditionalHealAfterHit,
  deckLookPlan,
  destroyJunkChoicePlan,
  discardChoiceFollowup,
  mandatoryDiscardChoiceCount,
  structuredFocusIfFastest,
  structuredNextAttackAnyZone,
  structuredNextAttackFlow,
  targetDiscardOnHitCount,
} from "../app/effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const kataRegistry = JSON.parse(await readFile(new URL("../content/card-effects/katas.json", import.meta.url), "utf8")).cards ?? {};
const bridgeSource = await readFile(new URL("../app/kata-playtest-bridge.ts", import.meta.url), "utf8");
const facadeSource = await readFile(new URL("../app/effect-resolvers.ts", import.meta.url), "utf8");
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);

function valuesFor(effect) {
  const values = {};
  for (const condition of effect.conditions ?? []) {
    const kind = String(condition.kind ?? "");
    if (kind === "beltAtLeast") values.belt = condition.value;
    else if (kind === "minimumDamage") values.damage = condition.value;
    else if (kind === "requiresCondition") values[String(condition.value ?? "")] = true;
    else if ([
      "marketCardsRemaining", "isFastest", "wasHitSinceLastTurn", "hasWeaponEquipped",
      "dealtDamagePreviousTurn", "hasTempo", "playedAttackThisTurn", "hpAtOrBelowHalfMax",
      "usedConsumableThisTurn", "discardedCardType", "discardedFocusValue", "attackZone",
      "differentCardTypesPlayedThisTurn", "learnedComboTriggeredThisTurn", "attackIsReversal",
      "firstCardPlayedThisTurn",
    ].includes(kind)) values[kind] = condition.value;
  }
  return values;
}

test("all 62 Core Katas are reachable through the Quick Duel structured host bridge", () => {
  const ids = Object.keys(kataRegistry).sort();
  assert.equal(ids.length, 62);
  for (const id of ids) {
    const source = card(id);
    assert.ok(source, id);
    const reached = new Set();
    for (const effect of kataRegistry[id].effects ?? []) {
      const commands = kataCommandsForHost(source, effect.trigger, valuesFor(effect));
      for (const command of commands) if (command.effectId) reached.add(command.effectId);
      assert.ok(reached.has(effect.id), `${id}/${effect.id} must be reachable from host facts through resolveKataEffects`);
    }
  }
});

test("Kata host bridge has no printed-prose dependency", () => {
  assert.doesNotMatch(bridgeSource, /rulesText|compileCardEffects|effect-resolvers-legacy/);
  assert.match(bridgeSource, /resolveKataEffects/);
  assert.match(bridgeSource, /structuredRuntimeEffects/);
});

test("deck-look Katas derive their plans from canonical structured parameters", () => {
  assert.deepEqual(kataDeckLookPlanForHost(card("DDB-KAT-CORE-018")), {
    kind: "pick-discard", count: 3, filter: "defense-or-kata", optional: false, noMatchFocus: 1,
  });
  assert.deepEqual(kataDeckLookPlanForHost(card("DDB-KAT-CORE-029")), {
    kind: "pick-reorder", count: 3, filter: "technique", optional: false,
  });
  assert.deepEqual(kataDeckLookPlanForHost(card("DDB-KAT-CORE-030")), {
    kind: "pick-shuffle", count: 5, filter: "item", optional: true,
  });
  assert.deepEqual(kataDeckLookPlanForHost(card("DDB-KAT-CORE-034")), {
    kind: "reorder", count: 2, distinctTypeFocus: 1,
  });
});

test("Kata destruction and discard costs are materialized from JSON", () => {
  assert.deepEqual(kataDestroyPlanForHost(card("DDB-KAT-CORE-010")), {
    count: 1, sources: ["hand", "discard"], optional: false, drawAfterHandDestroy: 1,
  });
  assert.deepEqual(kataDestroyPlanForHost(card("DDB-KAT-CORE-031")), {
    count: 1, sources: ["hand", "discard"], optional: false, drawAfterHandDestroy: 0,
  });
  assert.equal(kataMandatoryDiscardCountForHost(card("DDB-KAT-CORE-002")), 1);
  assert.equal(kataMandatoryDiscardCountForHost(card("DDB-KAT-CORE-039")), 1);
  assert.equal(kataMandatoryDiscardCountForHost(card("DDB-KAT-CORE-058")), 2);
});

test("discard-driven Kata branches execute from structured discard facts", () => {
  assert.deepEqual(kataDiscardFollowupForHost(card("DDB-KAT-CORE-002"), { discardedCardType: "Technique" }), {
    focus: 0, nextAttackPower: 1, nextDefenseGuard: 0, notes: ["structured Kata discard +1 next Attack Power"],
  });
  assert.deepEqual(kataDiscardFollowupForHost(card("DDB-KAT-CORE-002"), { discardedCardType: "Item" }), {
    focus: 0, nextAttackPower: 0, nextDefenseGuard: 1, notes: ["structured Kata discard +1 next Defense Guard"],
  });
  assert.equal(kataDiscardFollowupForHost(card("DDB-KAT-CORE-039"), { discardedFocusValue: 0 }).focus, 1);
  assert.equal(kataDiscardFollowupForHost(card("DDB-KAT-CORE-039"), { discardedFocusValue: 1 }).focus, 0);
});

test("Flow, zone, and fastest-Focus compatibility surfaces are backed by Kata commands", () => {
  assert.deepEqual(kataNextAttackFlowForHost(card("DDB-KAT-CORE-007"), "onPlay"), { handled: true, grant: true });
  assert.deepEqual(kataNextAttackAnyZoneForHost(card("DDB-KAT-CORE-026"), "onPlay"), { handled: true, grant: true });
  assert.equal(kataFastestFocusForHost(card("DDB-KAT-CORE-021"), 5, 4), 1);
  assert.equal(kataFastestFocusForHost(card("DDB-KAT-CORE-021"), 4, 5), 0);
});

test("Core Kata facade ignores contradictory printed text and lets canonical JSON win", () => {
  const fake = (id, rulesText) => ({ ...card(id), rulesText });
  assert.deepEqual(deckLookPlan(fake("DDB-KAT-CORE-018", "Draw 99 cards.")), {
    kind: "pick-discard", count: 3, filter: "defense-or-kata", optional: false, noMatchFocus: 1,
  });
  assert.equal(conditionalHealAfterHit(fake("DDB-KAT-CORE-047", "Heal 99 HP."), true), 3);
  assert.equal(mandatoryDiscardChoiceCount(fake("DDB-KAT-CORE-058", "No effect.")), 2);
  assert.equal(discardChoiceFollowup(fake("DDB-KAT-CORE-039", "Gain 99 Focus."), { ...card("DDB-STA-CORE-001"), focusValue: 0 }).focus, 1);
  const destroyPlan = destroyJunkChoicePlan(fake("DDB-KAT-CORE-010", "Destroy 9 Junk cards."));
  assert.equal(destroyPlan?.count, 1);
  assert.equal(destroyPlan?.resolver, "kata.structured");
  assert.equal(structuredFocusIfFastest(fake("DDB-KAT-CORE-021", "Gain 99 Focus."), 5, 4), 1);
  assert.deepEqual(structuredNextAttackFlow(fake("DDB-KAT-CORE-007", "No effect."), { timing: "onPlay", differentZoneFromPreviousAttack: false }), { handled: true, grant: true });
  assert.deepEqual(structuredNextAttackAnyZone(fake("DDB-KAT-CORE-026", "No effect."), { timing: "onPlay", attackNumber: 0 }), { handled: true, grant: true });
});

test("Core Attack target-discard helper cannot fall back to prose", () => {
  const fakeAttack = { ...card("DDB-ATK-CORE-023"), rulesText: "On Hit, target discards 9 cards." };
  assert.equal(targetDiscardOnHitCount(fakeAttack), 0);
});

test("shared facade explicitly protects Core Katas before legacy parser calls", () => {
  assert.match(facadeSource, /isCoreKataCard/);
  assert.match(facadeSource, /kataDeckLookPlanForHost/);
  assert.match(facadeSource, /kataDiscardFollowupForHost/);
  assert.match(facadeSource, /kataConditionalHealForHost/);
});
