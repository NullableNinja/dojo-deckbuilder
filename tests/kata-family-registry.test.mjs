import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveKataEffect, resolveKataEffects, SUPPORTED_KATA_RESOLVERS } from "../app/kata-effect-resolvers.ts";

const cardsSource = await readFile(new URL("../content/cards.json", import.meta.url), "utf8");
const registrySource = await readFile(new URL("../content/card-effects/katas.json", import.meta.url), "utf8");
const schema = JSON.parse(await readFile(new URL("../content/card-effect.schema.json", import.meta.url), "utf8"));
const cards = JSON.parse(cardsSource).cards;
const registry = JSON.parse(registrySource);

const canonicalKatas = cards
  .filter((card) => String(card.catalogId ?? "").startsWith("DDB-KAT-CORE-"))
  .sort((a, b) => String(a.catalogId).localeCompare(String(b.catalogId)));
const canonicalIds = canonicalKatas.map((card) => card.catalogId);
const registryIds = Object.keys(registry.cards).sort();
const registryCard = (catalogId) => registry.cards[catalogId];
const canonicalCard = (catalogId) => canonicalKatas.find((card) => card.catalogId === catalogId);

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

test("Kata family registry exactly covers the 62 canonical Core Katas", () => {
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.rulesVersion, "v2.3");
  assert.equal(registry.rulesRevision, "v2.3-r5");
  assert.equal(registry.family, "Kata");
  assert.equal(canonicalIds.length, 62, "canonical Kata count changed; reconcile migration coverage deliberately");
  assert.equal(new Set(canonicalIds).size, canonicalIds.length, "canonical catalog has duplicate Kata IDs");
  assert.equal(registryIds.length, 62);
  assert.deepEqual(registryIds, canonicalIds);
  for (const catalogId of canonicalIds) {
    assert.equal(registryCard(catalogId).name, canonicalCard(catalogId).name, `${catalogId} name must match canonical printed data`);
    assert.ok(Array.isArray(registryCard(catalogId).effects) && registryCard(catalogId).effects.length > 0, `${catalogId} must have executable effects`);
  }
});

test("Kata family JSON has no duplicate raw Catalog ID keys", () => {
  const rawKeys = [...registrySource.matchAll(/"(DDB-KAT-CORE-\d{3})"\s*:/g)].map((match) => match[1]);
  assert.equal(rawKeys.length, 62);
  assert.equal(new Set(rawKeys).size, rawKeys.length);
});

test("every Kata effect conforms to the canonical effect schema enums", () => {
  const props = schema.properties;
  const triggers = new Set(props.trigger.enum);
  const actions = new Set(props.action.enum);
  const targets = new Set(props.target.enum);
  const durations = new Set(props.duration.enum);
  const operators = new Set(props.conditions.items.properties.operator.enum);

  for (const catalogId of registryIds) {
    const effectIds = new Set();
    for (const effect of registryCard(catalogId).effects) {
      assert.ok(triggers.has(effect.trigger), `${catalogId} invalid trigger ${effect.trigger}`);
      assert.ok(actions.has(effect.action), `${catalogId} invalid action ${effect.action}`);
      if (effect.target !== undefined) assert.ok(targets.has(effect.target), `${catalogId} invalid target ${effect.target}`);
      if (effect.duration !== undefined) assert.ok(durations.has(effect.duration), `${catalogId} invalid duration ${effect.duration}`);
      if (effect.action === "custom") assert.ok(effect.resolver, `${catalogId} custom action requires resolver`);
      if (effect.id) {
        assert.ok(!effectIds.has(effect.id), `${catalogId} duplicate effect id ${effect.id}`);
        effectIds.add(effect.id);
      }
      for (const condition of effect.conditions ?? []) {
        assert.ok(condition.kind, `${catalogId} condition kind is required`);
        if (condition.operator !== undefined) assert.ok(operators.has(condition.operator), `${catalogId} invalid operator ${condition.operator}`);
      }
    }
  }
});

test("every dedicated Kata resolver is implemented and every migrated effect emits an executable command", () => {
  for (const catalogId of registryIds) {
    for (const effect of registryCard(catalogId).effects) {
      if (effect.resolver) assert.ok(SUPPORTED_KATA_RESOLVERS.has(effect.resolver), `${catalogId}: ${effect.resolver}`);
      const commands = resolveKataEffect(effect, { trigger: effect.trigger, values: valuesFor(effect) });
      assert.ok(commands.length > 0, `${catalogId} ${effect.id ?? effect.action} must execute from structured data`);
      assert.ok(commands.every((command) => command.effectId === effect.id), `${catalogId} command must preserve effect identity`);
    }
  }
});

test("Kata resolver semantics are actor-neutral for player and AI execution", () => {
  for (const catalogId of registryIds) {
    for (const effect of registryCard(catalogId).effects) {
      const values = valuesFor(effect);
      const player = resolveKataEffect(effect, { trigger: effect.trigger, values: { ...values, actor: "player" } });
      const ai = resolveKataEffect(effect, { trigger: effect.trigger, values: { ...values, actor: "ai" } });
      assert.deepEqual(ai, player, `${catalogId} must not diverge by actor in the shared resolver layer`);
    }
  }
});

test("conditional and branch Kata semantics execute from structured data", () => {
  const run = (id, trigger, values = {}) => resolveKataEffects(registryCard(id).effects, { trigger, values });
  assert.equal(run("DDB-KAT-CORE-004", "onPlay", { belt: "Brown" })[0].amount, 2);
  assert.equal(run("DDB-KAT-CORE-004", "onPlay", { belt: "Purple" }).length, 0);
  assert.equal(run("DDB-KAT-CORE-011", "onPlay", { marketCardsRemaining: 5 })[0].amount, 1);
  assert.equal(run("DDB-KAT-CORE-011", "onPlay", { marketCardsRemaining: 4 }).length, 0);
  assert.equal(run("DDB-KAT-CORE-051", "onPlay", { hpAtOrBelowHalfMax: true })[0].action, "heal");
  assert.equal(run("DDB-KAT-CORE-051", "onPlay", { hpAtOrBelowHalfMax: false })[0].kind, "grantFlow");
});

test("discard-driven Katas keep player choice branches structured", () => {
  const run = (id, trigger, values = {}) => resolveKataEffects(registryCard(id).effects, { trigger, values });
  const huddleTech = run("DDB-KAT-CORE-002", "afterResolve", { discardedCardType: "Technique" });
  assert.equal(huddleTech.length, 1);
  assert.equal(huddleTech[0].action, "modifyAttackPower");
  const huddleItem = run("DDB-KAT-CORE-002", "afterResolve", { discardedCardType: "Item" });
  assert.equal(huddleItem.length, 1);
  assert.equal(huddleItem[0].action, "modifyGuard");
  assert.equal(run("DDB-KAT-CORE-039", "afterResolve", { discardedFocusValue: 0 })[0].action, "gainFocus");
  assert.equal(run("DDB-KAT-CORE-039", "afterResolve", { discardedFocusValue: 1 }).length, 0);
});

test("deck, economy, equipment, and deferred-combat Katas emit semantic commands without prose parsing", () => {
  const run = (id, trigger, values = {}) => resolveKataEffects(registryCard(id).effects, { trigger, values });
  assert.equal(run("DDB-KAT-CORE-018", "onPlay")[0].kind, "resolveDeckLook");
  assert.deepEqual(run("DDB-KAT-CORE-018", "onPlay")[0].params.eligibleTypes, ["Defense", "Kata"]);
  assert.equal(run("DDB-KAT-CORE-025", "onPlay")[0].kind, "revealUntilMatch");
  assert.equal(run("DDB-KAT-CORE-030", "onPlay")[0].params.restAction, "shuffle");
  assert.equal(run("DDB-KAT-CORE-017", "onPlay")[0].kind, "promptEquipmentActivation");
  assert.equal(run("DDB-KAT-CORE-022", "onPlay")[0].kind, "armPurchaseDiscount");
  assert.equal(run("DDB-KAT-CORE-046", "onPlay")[0].kind, "equipFromHand");
  assert.equal(run("DDB-KAT-CORE-062", "onPlay")[0].kind, "armWeaponModifier");
  assert.equal(run("DDB-KAT-CORE-008", "afterResolve")[0].kind, "resolveDeferredEvent");
  assert.equal(run("DDB-KAT-CORE-023", "onPlay")[0].kind, "armControlledEscalation");
  assert.equal(run("DDB-KAT-CORE-037", "onPlay")[0].kind, "armDamagePrevention");
  assert.equal(run("DDB-KAT-CORE-060", "onPlay")[0].kind, "armThreeZonePlan");
});
