import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { effectPlanForCard } from "../app/card-effects.ts";
import { comboPlanForHost } from "../app/combo-playtest-bridge.ts";
import { isSupportedComboResolver, structuredComboEffects } from "../app/combo-runtime.ts";
import { createBossRuntimeState, resolveBossCardEvent } from "../app/boss-runtime.ts";
import { structuredEquipmentAfterResolveResolution, structuredEquipmentAttackDeclarationResolution, structuredEquipmentBlockResolution, structuredEquipmentDamagePrevention, structuredEquipmentHitResolution, structuredEquipmentMinimumSpeed, structuredEquipmentPurchaseResolution, structuredPostBlockCycle } from "../app/equipment-structured.ts";
import { equipmentOnEquipPlan } from "../app/effect-resolvers.ts";

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

test("Equipment on-Hit delayed combat effects become lifecycle statuses", () => {
  const delayedSpeed = structuredEquipmentHitResolution([{ id: "mop", catalogId: "DDB-WPN-CORE-014" }], {
    attackNumber: 1,
    attackZone: "Low",
    combatDamageDealt: 1,
    firstHitThisTurn: true,
    attackUsesSourceEquipment: true,
    usedEffectIdsThisRound: [],
  });
  assert.deepEqual(delayedSpeed.delayedStatuses, [{ sourceEffectId: "equipment-wpn-014-low-hit-speed-penalty", effect: "combat.modifySpeed", amount: -1, duration: "nextRound", target: "opponent" }]);
  assert.deepEqual(delayedSpeed.unsupported, []);

  const delayedDamage = structuredEquipmentHitResolution([{ id: "bottle", catalogId: "DDB-WPN-CORE-006" }], {
    attackNumber: 1,
    attackZone: "High",
    combatDamageDealt: 1,
    firstHitThisTurn: true,
    attackUsesSourceEquipment: true,
    usedEffectIdsThisRound: [],
  });
  assert.deepEqual(delayedDamage.delayedStatuses, [{ sourceEffectId: "equipment-wpn-006-delayed-direct-damage", effect: "combat.dealDamage", amount: 1, duration: "endOfTargetNextTurn", target: "opponent" }]);

  const healingSuppression = structuredEquipmentHitResolution([{ id: "kris", catalogId: "DDB-WPN-CORE-038" }], {
    attackNumber: 1,
    attackZone: "High",
    combatDamageDealt: 1,
    firstHitThisTurn: true,
    attackUsesSourceEquipment: true,
    usedEffectIdsThisRound: [],
  });
  assert.deepEqual(healingSuppression.delayedStatuses, [{ sourceEffectId: "equipment-wpn-038-healing-suppression", effect: "combat.modifyHealing", amount: 2, duration: "nextInitiate", target: "opponent" }]);

  const delayedDefense = structuredEquipmentHitResolution([{ id: "staff", catalogId: "DDB-WPN-CORE-058" }], {
    attackNumber: 1,
    attackZone: "Mid",
    combatDamageDealt: 1,
    firstHitThisTurn: true,
    attackUsesSourceEquipment: true,
    usedEffectIdsThisRound: [],
  });
  assert.deepEqual(delayedDefense.delayedStatuses, [{ sourceEffectId: "equipment-wpn-058-hit-defense-until-next-initiate", effect: "combat.modifyDefense", amount: 1, duration: "nextInitiate", target: "self" }]);

  const tempo = structuredEquipmentHitResolution([{ id: "whip", catalogId: "DDB-WPN-CORE-064" }], {
    attackNumber: 1,
    attackZone: "High",
    combatDamageDealt: 1,
    firstHitThisTurn: true,
    attackUsesSourceEquipment: true,
    usedEffectIdsThisRound: [],
  });
  assert.equal(tempo.targetTempoLoss, true);
  assert.deepEqual(tempo.unsupported, []);
});

test("Equipment on-Block modifiers resolve through one shared lifecycle", () => {
  const block = (catalogId, context = {}) => structuredEquipmentBlockResolution([{ id: catalogId.toLowerCase(), catalogId }], {
    incomingZone: "Low",
    incomingAttackUsesWeapon: false,
    defenseTags: ["Dodge"],
    sourceArmorHelpedBlock: true,
    firstArmorBlockThisRound: true,
    defenderPlayedDefense: true,
    sameOpponentAsBlockedAttack: true,
    sameRoundOnly: true,
    sameTurnOnly: true,
    beltName: "Blue",
    ...context,
  });
  assert.equal(block("DDB-DEQ-CORE-005").focus, 1);
  assert.equal(block("DDB-DEQ-CORE-015").speed, 1);
  const purchase = block("DDB-DEQ-CORE-011");
  assert.equal(purchase.purchaseDiscount, -1);
  assert.equal(purchase.minimumFinalCost, 1);
  assert.equal(block("DDB-DEQ-CORE-034").opponentFocusLoss, 1);
  assert.equal(block("DDB-WPN-CORE-013").nextAttackPower, 1);
  const sectional = block("DDB-WPN-CORE-055");
  assert.equal(sectional.nextAttackPower, 1);
  assert.deepEqual(sectional.unsupported, ["equipment-wpn-055-dodge-block-cycle"]);

  const mirror = block("DDB-DEQ-CORE-045", { opponentTopCardId: "top-card" });
  assert.equal(mirror.revealedTopCardId, "top-card");
  assert.deepEqual(mirror.unsupported, []);
});

test("Equipment declaration and damage prevention share once-per-game destruction semantics", () => {
  const cutout = structuredEquipmentAttackDeclarationResolution([{ id: "cutout", catalogId: "DDB-DEQ-CORE-007" }], {
    incomingAttackTargetsSelf: true,
    firstIncomingAttackThisRound: true,
  });
  assert.equal(cutout.preventAttackDamage, true);
  assert.deepEqual(cutout.destroySourceIds, ["cutout"]);
  assert.deepEqual(cutout.unsupported, []);

  const cutoutAgain = structuredEquipmentAttackDeclarationResolution([{ id: "cutout", catalogId: "DDB-DEQ-CORE-007" }], {
    incomingAttackTargetsSelf: true,
    firstIncomingAttackThisRound: true,
    usedEffectIdsThisGame: ["equipment-deq-007-once-game-zero-attack"],
  });
  assert.equal(cutoutAgain.preventAttackDamage, false);
  assert.deepEqual(cutoutAgain.matchedEffectIds, []);

  const stuntDouble = structuredEquipmentDamagePrevention([{ id: "stunt", catalogId: "DDB-DEQ-CORE-040" }], { damage: 4 });
  assert.equal(stuntDouble.preventAll, true);
  assert.deepEqual(stuntDouble.destroySourceIds, ["stunt"]);
  assert.deepEqual(stuntDouble.unsupported, []);

  const stuntDoubleAgain = structuredEquipmentDamagePrevention([{ id: "stunt", catalogId: "DDB-DEQ-CORE-040" }], {
    damage: 4,
    usedEffectIdsThisGame: ["equipment-deq-040-once-game-prevent-all-damage"],
  });
  assert.equal(stuntDoubleAgain.preventAll, false);
  assert.deepEqual(stuntDoubleAgain.matchedEffectIds, []);
});

test("canonical Equipment minimum-stat actions project through the generic resolver", () => {
  assert.equal(structuredEquipmentMinimumSpeed({ catalogId: "DDB-WPN-CORE-018" }), 2);
  assert.equal(structuredEquipmentMinimumSpeed({ catalogId: "DDB-DEQ-CORE-001" }), 0);
});

test("structured draw-discard Block choices use the shared post-Block cycle protocol", () => {
  const sectional = structuredPostBlockCycle({ id: "staff", catalogId: "DDB-WPN-CORE-055" });
  assert.deepEqual(sectional, { minBelt: "White", zone: "", defenseTag: "Dodge", draw: 1, discard: 1 });
});

test("Equipment on-Equip plans expose canonical follow-ups", () => {
  const plan = equipmentOnEquipPlan({ catalogId: "DDB-WPN-CORE-023", subtype: "Weapon" }, { catalogId: "DDB-WPN-CORE-023", subtype: "Weapon" }, { beltName: "White" });
  assert.equal(plan.nextAttackPower, 1);
  assert.deepEqual(plan.unsupported, []);
});

test("choice-free Equipment after-Resolve watchers execute once through the shared protocol", () => {
  const fan = structuredEquipmentAfterResolveResolution([{ id: "fan", catalogId: "DDB-GEA-CORE-001" }], {
    resolvedCardType: "Kata",
    usedEffectIdsThisRound: [],
  });
  assert.equal(fan.focus, 1);
  assert.deepEqual(fan.exhaustSourceIds, ["fan"]);
  assert.deepEqual(fan.unsupported, []);

  const repeat = structuredEquipmentAfterResolveResolution([{ id: "fan", catalogId: "DDB-GEA-CORE-001" }], {
    resolvedCardType: "Kata",
    usedEffectIdsThisRound: ["equipment-gea-001-after-kata-focus", "equipment-gea-001-exhaust"],
  });
  assert.equal(repeat.focus, 0);
  assert.deepEqual(repeat.exhaustSourceIds, []);
});

test("choice-requiring Equipment after-Resolve watchers stay explicit", () => {
  const kunai = structuredEquipmentAfterResolveResolution([{ id: "kunai", catalogId: "DDB-WPN-CORE-040" }], {
    resolvedCardType: "Attack",
    defenderPlayedDefense: false,
  });
  assert.equal(kunai.draw, 0);
  assert.ok(kunai.unsupported.includes("equipment-wpn-040-no-defense-cycle-discard"));
});

test("Equipment purchase timing exposes discounts before payment and exhausts sources after payment", () => {
  const source = { id: "map", catalogId: "DDB-GEA-CORE-012" };
  const preview = structuredEquipmentPurchaseResolution([source], {
    marketEndSlot: true,
    purchasedCardCost: 4,
    purchaseCompleted: false,
  });
  assert.equal(preview.purchaseDiscount, -1);
  assert.equal(preview.minimumFinalCost, 2);
  assert.deepEqual(preview.exhaustSourceIds, []);

  const committed = structuredEquipmentPurchaseResolution([source], {
    marketEndSlot: true,
    purchasedCardCost: 4,
    purchaseCompleted: true,
  });
  assert.deepEqual(committed.exhaustSourceIds, ["map"]);
  assert.ok(committed.matchedEffectIds.includes("equipment-gea-012-exhaust"));
});

test("Portable Suggestion Box exposes a post-purchase hand-filing choice", () => {
  const source = { id: "suggestion-box", catalogId: "DDB-GEA-CORE-018" };
  const preview = structuredEquipmentPurchaseResolution([source], {
    purchasedCardCost: 2,
    purchaseCompleted: false,
  });
  assert.equal(preview.choiceRequired, false);
  assert.deepEqual(preview.exhaustSourceIds, []);

  const committed = structuredEquipmentPurchaseResolution([source], {
    purchasedCardCost: 2,
    purchaseCompleted: true,
  });
  assert.equal(committed.choiceRequired, true);
  assert.deepEqual(committed.exhaustSourceIds, ["suggestion-box"]);
  assert.deepEqual(committed.unsupported, []);
});
