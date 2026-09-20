import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { effectPlanForCard } from "../app/card-effects.ts";
import { comboPlanForHost } from "../app/combo-playtest-bridge.ts";
import { isSupportedComboResolver, structuredComboEffects } from "../app/combo-runtime.ts";
import { createBossRuntimeState, resolveBossCardEvent } from "../app/boss-runtime.ts";
import { structuredEquipmentHitResolution } from "../app/equipment-structured.ts";

const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards ?? [];
const registry = JSON.parse(await readFile(new URL("../app/data/card-effects.json", import.meta.url), "utf8"));
const cardsByCatalogId = new Map(cards.map((card) => [card.catalogId, card]));

test("every canonical structured-effect entry resolves as structured data, never card prose", () => {
  const failures = [];
  for (const catalogId of Object.keys(registry.cards ?? {})) {
    const card = cardsByCatalogId.get(catalogId);
    if (!card) {
      failures.push(`${catalogId}: missing generated canonical card`);
      continue;
    }
    const plan = effectPlanForCard(card, registry);
    if (plan.source !== "structured") failures.push(`${catalogId}: resolved through ${plan.source}`);
  }
  assert.deepEqual(failures, []);
});

test("structured effects override contradictory printed prose", () => {
  const plan = effectPlanForCard({
    rulesText: "Draw 99 cards and gain 99 Focus.",
    effects: [
      { id: "canonical-draw", trigger: "onPlay", action: "draw", target: "self", amount: 1 },
    ],
  });
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, [{ timing: "onPlay", kind: "draw", amount: 1 }]);
  assert.deepEqual(plan.unsupported, []);
});

test("unsupported structured behavior stays explicit instead of falling back to prose", () => {
  const plan = effectPlanForCard({
    rulesText: "Draw 99 cards.",
    effects: [
      { id: "canonical-custom", trigger: "onPlay", action: "custom", resolver: "test.pendingResolver" },
    ],
  });
  assert.equal(plan.source, "structured");
  assert.deepEqual(plan.effects, []);
  assert.deepEqual(plan.unsupported, ["canonical-custom"]);
});

test("canonical Combo effects are covered by the generic Combo host", () => {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(registry.cards ?? {})) {
    if (!catalogId.includes("-CMB-")) continue;
    const combo = cardsByCatalogId.get(catalogId);
    const effects = structuredComboEffects(combo ?? catalogId);
    for (const effect of effects) {
      if (effect.resolver && !isSupportedComboResolver(effect.resolver)) {
        failures.push(`${catalogId}/${effect.id}: unsupported resolver ${effect.resolver}`);
      }
    }
    if (!combo) {
      failures.push(`${catalogId}: missing canonical card`);
      continue;
    }
    const plan = comboPlanForHost(combo, {
      priorCards: [],
      currentCard: combo,
      currentZone: "Mid",
      zonesPlayed: [],
      equipment: [],
      attacksThisTurn: 0,
      hitThisTurn: false,
      blockedThisRound: false,
      defendedThisRound: false,
    });
    assert.deepEqual(plan.unsupportedEffectIds, [], `${catalogId} has effects not projected by the Combo host`);
  }
  assert.deepEqual(failures, []);
});

test("effect coverage recognizes all completed Combo and Reaction Item resolver contracts", () => {
  const plans = cards
    .filter((card) => card.catalogId?.includes("-CMB-") || card.catalogId?.includes("-RIT-"))
    .map((card) => ({ card, plan: effectPlanForCard(card, registry) }));
  assert.equal(plans.length, 67);
  assert.deepEqual(plans.filter(({ plan }) => plan.unsupported.length).map(({ card }) => card.catalogId), []);
});

test("the complete Boss cohort resolves through the generic Boss host", () => {
  const bosses = cards.filter((card) => /-B(?:AT|PR|TQ|DF|ST)-/.test(card.catalogId ?? ""));
  assert.equal(bosses.length, 45);
  assert.deepEqual(
    bosses.flatMap((card) => effectPlanForCard(card, registry).unsupported.map((effectId) => `${card.catalogId}/${effectId}`)),
    [],
  );

  const enrage = resolveBossCardEvent({
    card: "DDB-BST-CORE-001",
    trigger: "passive",
    context: { bossHp: 30 },
    state: createBossRuntimeState({ boss: { hp: 30, maxHp: 40, hand: [], discard: [], statuses: [], restrictions: [] } }),
  });
  assert.equal(enrage.state.enraged, true);

  const hit = resolveBossCardEvent({
    card: "DDB-BAT-CORE-004",
    trigger: "onHit",
    state: createBossRuntimeState({ player: { hp: 10, maxHp: 10, hand: ["card-1"], discard: [], statuses: [], restrictions: [] } }),
  });
  assert.deepEqual(hit.state.player.hand, []);
  assert.deepEqual(hit.state.player.discard, ["card-1"]);

  const guard = resolveBossCardEvent({
    card: "DDB-BDF-CORE-001",
    trigger: "onPlay",
    context: { incomingZones: ["High"] },
    state: createBossRuntimeState(),
  });
  assert.deepEqual(guard.state.bossGuard && { zone: guard.state.bossGuard.zone, preventDamage: guard.state.bossGuard.preventDamage }, { zone: "High", preventDamage: 3 });

  const technique = resolveBossCardEvent({
    card: "DDB-BTQ-CORE-001",
    trigger: "onPlay",
    context: { bossHp: 25 },
    state: createBossRuntimeState({ boss: { hp: 25, maxHp: 40, hand: [], discard: [], statuses: [], restrictions: [] } }),
  });
  assert.equal(technique.state.revealedArsenal, 1);
  assert.ok(technique.state.boss.statuses.some((status) => status.amount === 2 && status.duration === "nextAttack"));
});

test("Equipment on-Hit modifiers resolve through the shared hit protocol", () => {
  const dragonSword = structuredEquipmentHitResolution([{ id: "weapon", catalogId: "DDB-WPN-CORE-015" }], {
    attackNumber: 1,
    attackZone: "High",
    attackTags: ["Punch"],
    combatDamageDealt: 3,
    firstHitThisTurn: true,
    firstQualifyingHitThisTurn: true,
    attackUsesSourceEquipment: true,
  });
  assert.equal(dragonSword.directDamage, 2);
  assert.deepEqual(dragonSword.unsupported, []);
  assert.deepEqual(dragonSword.matchedEffectIds, ["equipment-wpn-015-first-hit-additional-damage"]);

  const repeat = structuredEquipmentHitResolution([{ id: "weapon", catalogId: "DDB-WPN-CORE-015" }], {
    attackNumber: 2,
    attackZone: "High",
    combatDamageDealt: 3,
    firstHitThisTurn: false,
    usedEffectIdsThisTurn: ["equipment-wpn-015-first-hit-additional-damage"],
  });
  assert.equal(repeat.directDamage, 0);
  assert.deepEqual(repeat.matchedEffectIds, []);

  const nunchaku = structuredEquipmentHitResolution([{ id: "weapon", catalogId: "DDB-WPN-CORE-045" }], {
    attackNumber: 1,
    attackZone: "Mid",
    attackTags: ["Kick"],
    combatDamageDealt: 1,
    firstHitThisTurn: true,
  });
  assert.equal(nunchaku.grantFlow, true);
  assert.deepEqual(nunchaku.unsupported, []);

  const yoYo = structuredEquipmentHitResolution([{ id: "weapon", catalogId: "DDB-WPN-CORE-065" }], {
    attackNumber: 2,
    attackZone: "Low",
    combatDamageDealt: 1,
    firstHitThisTurn: false,
    attackUsesSourceEquipment: true,
  });
  assert.equal(yoYo.focus, 1);
  assert.deepEqual(yoYo.unsupported, []);

  const frozenBurrito = structuredEquipmentHitResolution([{ id: "weapon", catalogId: "DDB-WPN-CORE-025" }], {
    attackNumber: 2,
    attackZone: "Low",
    combatDamageDealt: 1,
    firstHitThisTurn: false,
    attackUsesSourceEquipment: true,
    usedEffectIdsThisRound: ["some-other-equipment-effect"],
  });
  assert.equal(frozenBurrito.focus, 1);
  assert.deepEqual(frozenBurrito.unsupported, []);

  const frozenBurritoAgain = structuredEquipmentHitResolution([{ id: "weapon", catalogId: "DDB-WPN-CORE-025" }], {
    attackNumber: 3,
    attackZone: "Low",
    combatDamageDealt: 1,
    firstHitThisTurn: true,
    usedEffectIdsThisTurn: ["equipment-wpn-025-hit-focus"],
  });
  assert.equal(frozenBurritoAgain.focus, 0);
});
