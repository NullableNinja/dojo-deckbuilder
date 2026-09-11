import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { consumableRuntimeCommands, structuredConsumableDestroyJunkPlan } from "../app/consumable-effect-resolvers.ts";
import { armConsumableAttackFollowupStatuses, resolveConsumableAttackFollowupStatuses } from "../app/stage3c-consumable-attack-followup.ts";
import { armConsumableHideStatuses, resolveConsumableHideStatuses } from "../app/stage3c-consumable-hide-followup.ts";
import { firstEventReactionCard } from "../app/stage3c-consumable-event-reactions.ts";
import { canPlayCoreConsumableInPhase } from "../app/stage3c-consumable-play-window.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const family = JSON.parse(await readFile(new URL("../content/card-effects/consumables.json", import.meta.url), "utf8")).cards ?? {};
const playtestSource = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);
const base = {
  hpThresholdMet: true,
  hasTempo: true,
  handEmptyAfterHeal: true,
  normalAttacksResolvedThisTurn: 2,
  reactionItemUsedSinceLastTurn: true,
  temporaryNegativeModifierPresent: true,
  removedTemporaryNegativeModifier: true,
  nextAttackBlocked: true,
  interferencePrevented: false,
  chosenFriendlyIsBenched: false,
  chosenFriendlyIsConscious: true,
  sameTurnSourceActive: true,
  discardedCount: 2,
  revealedFocusValue: 3,
  revealedDifferentTypeCount: 3,
  friendlyTargetCount: 1,
  opponentTargetCount: 1,
  junkDestroyed: true,
  selectedEquipmentSubtype: "Gear",
};
const commands = (catalogId, trigger = "onPlay", extra = {}) => consumableRuntimeCommands(card(catalogId), trigger, { ...base, ...extra });

const certified = [
  "DDB-CON-CORE-001", "DDB-CON-CORE-002", "DDB-CON-CORE-003", "DDB-CON-CORE-005", "DDB-CON-CORE-006",
  "DDB-CON-CORE-013", "DDB-CON-CORE-014", "DDB-CON-CORE-016", "DDB-CON-CORE-019", "DDB-CON-CORE-020",
  "DDB-CON-CORE-023", "DDB-CON-CORE-024", "DDB-CON-CORE-027", "DDB-CON-CORE-028", "DDB-CON-CORE-029",
  "DDB-CON-CORE-036", "DDB-CON-CORE-037", "DDB-CON-CORE-040", "DDB-CON-CORE-041", "DDB-CON-CORE-042",
  "DDB-CON-CORE-043", "DDB-CON-CORE-046", "DDB-CON-CORE-047", "DDB-CON-CORE-048", "DDB-CON-CORE-050",
  "DDB-CON-CORE-057", "DDB-CON-CORE-058", "DDB-CON-CORE-059", "DDB-CON-CORE-060", "DDB-CON-CORE-062",
];

test("Stage 3C batch certifies thirty distinct Core Consumables with structured source entries", () => {
  assert.equal(new Set(certified).size, 30);
  for (const id of certified) {
    assert.ok(card(id), `${id} must exist in the Core catalog`);
    assert.ok(family[id]?.effects?.length, `${id} must have structured effects`);
  }
});

test("twelve healing Consumables reach the real Quick Duel HP mutation without a solo-target dead choice", () => {
  const healing = [
    "DDB-CON-CORE-003", "DDB-CON-CORE-013", "DDB-CON-CORE-014", "DDB-CON-CORE-016",
    "DDB-CON-CORE-023", "DDB-CON-CORE-027", "DDB-CON-CORE-028", "DDB-CON-CORE-047",
    "DDB-CON-CORE-050", "DDB-CON-CORE-057", "DDB-CON-CORE-058", "DDB-CON-CORE-060",
  ];
  for (const id of healing) {
    const heals = commands(id).filter((command) => command.effect === "core.heal");
    assert.ok(heals.length, `${id} must emit a heal command`);
    assert.ok(heals.every((command) => !command.choice), `${id} must auto-resolve its only friendly Quick Duel target`);
  }
  assert.ok(playtestSource.includes('command.effect === "core.heal"'));
  assert.ok(playtestSource.includes("Math.min(next.maxHp, next.hp + Math.max(0, command.amount))"));
});

test("Instant Noodles and Warranty Ice Pop use actual runtime context instead of unconditional follow-ups", () => {
  const noodlesFull = commands("DDB-CON-CORE-028", "onPlay", { handEmptyAfterHeal: false });
  const noodlesEmpty = commands("DDB-CON-CORE-028", "onPlay", { handEmptyAfterHeal: true });
  assert.equal(noodlesFull.some((command) => command.effect === "core.draw"), false);
  assert.equal(noodlesEmpty.some((command) => command.effect === "core.draw" && command.amount === 1), true);

  const icePopNormal = commands("DDB-CON-CORE-058", "onPlay", { reactionItemUsedSinceLastTurn: false })
    .filter((command) => command.effect === "core.heal").reduce((total, command) => total + command.amount, 0);
  const icePopBonus = commands("DDB-CON-CORE-058", "onPlay", { reactionItemUsedSinceLastTurn: true })
    .filter((command) => command.effect === "core.heal").reduce((total, command) => total + command.amount, 0);
  assert.ok(icePopBonus > icePopNormal, "Reaction history must increase Warranty Ice Pop healing");
  assert.ok(playtestSource.includes("reactionItemUsedSinceLastTurn"));
});

test("Banana Peel, Pocket Sand, and Water Balloon auto-target the sole opponent but preserve multiplayer choice", () => {
  const cases = [
    ["DDB-CON-CORE-002", "consumable.chooseOpponentNextAttackPenalty"],
    ["DDB-CON-CORE-043", "consumable.chooseOpponentNextDefenseGuardPenalty"],
    ["DDB-CON-CORE-059", "consumable.chooseOpponentSpeedPenalty"],
  ];
  for (const [id, resolver] of cases) {
    const duel = commands(id).find((command) => command.resolver === resolver);
    const multi = commands(id, "onPlay", { opponentTargetCount: 2 }).find((command) => command.resolver === resolver);
    assert.ok(duel, `${id} must emit ${resolver}`);
    assert.equal(duel.choice, undefined, `${id} must not dead-end on a one-opponent choice`);
    assert.ok(multi?.choice, `${id} must preserve a real target choice with multiple opponents`);
  }
});

test("Fresh Martial Arts Gi, Kombucha, and Sensei's Advice preserve distinct structured Junk semantics", () => {
  assert.deepEqual(structuredConsumableDestroyJunkPlan(card("DDB-CON-CORE-024")), {
    resolver: "consumable.destroyJunkThenDrawTwo", count: 1, sources: ["hand", "discard"], optional: false, drawAfterSuccess: 2,
  });
  assert.deepEqual(structuredConsumableDestroyJunkPlan(card("DDB-CON-CORE-029")), {
    resolver: "consumable.destroyJunkFromHand", count: 1, sources: ["hand"], optional: false, drawAfterSuccess: 0,
  });
  assert.deepEqual(structuredConsumableDestroyJunkPlan(card("DDB-CON-CORE-048")), {
    resolver: "consumable.optionalDestroyJunkFromHand", count: 1, sources: ["hand"], optional: true, drawAfterSuccess: 0,
  });
  assert.equal(commands("DDB-CON-CORE-024", "onPlay", { junkDestroyed: false }).some((command) => command.effect === "core.draw"), false);
  assert.equal(commands("DDB-CON-CORE-024", "onPlay", { junkDestroyed: true }).some((command) => command.effect === "core.draw" && command.amount === 2), true);
});

test("Caffeinated Mochi and three custom-stat Consumables retain their executable stat semantics", () => {
  const mochi = commands("DDB-CON-CORE-006");
  assert.ok(mochi.some((command) => command.effect === "core.draw" && command.amount === 2));
  assert.ok(mochi.some((command) => command.effect === "combat.modifySpeed" && command.amount === -1));
  for (const id of ["DDB-CON-CORE-014", "DDB-CON-CORE-019", "DDB-CON-CORE-042"]) {
    assert.ok(commands(id).some((command) => command.effect === "core.custom"), `${id} must emit its dedicated custom stat command`);
  }
  assert.ok(playtestSource.includes("applyStage3CBoardCustomCommand"));
  assert.ok(playtestSource.includes("revertStage3CBoardCustomStatus"));
});

test("Expired Protein Shake and Overtime Espresso survive one-use cleanup and resolve their Hide damage", () => {
  const shake = resolveConsumableHideStatuses(armConsumableHideStatuses([], card("DDB-CON-CORE-019")));
  const espresso = resolveConsumableHideStatuses(armConsumableHideStatuses([], card("DDB-CON-CORE-040")));
  assert.equal(shake.directSelfDamage, 2);
  assert.equal(espresso.directSelfDamage, 1);
  assert.ok(playtestSource.includes("resolveConsumableHideStatuses(board.stage3cStatuses ?? [])"));
});

test("Mystery Jerky, Rubber Chicken, and Pocket Yoyo resolve watched-Attack follow-ups through one shared lifecycle", () => {
  const jerky = resolveConsumableAttackFollowupStatuses(armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-037")), { blocked: true, interferencePrevented: false });
  const chicken = resolveConsumableAttackFollowupStatuses(armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-046")), { blocked: false, interferencePrevented: false });
  const yoyo = resolveConsumableAttackFollowupStatuses(armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-062")), { blocked: true, interferencePrevented: false });
  assert.ok(jerky.directSelfDamage > 0, "Mystery Jerky must resolve blocked-Attack backlash");
  assert.ok(chicken.focus > 0, "Rubber Chicken must resolve its watched-Attack Focus payoff");
  assert.ok(yoyo.focus > 0, "Pocket Yoyo must resolve its blocked-Attack Focus payoff");
  assert.ok(playtestSource.includes("resolveConsumableAttackFollowupStatuses"));
});

test("Bubble Wrap, Emergency Ice Pack, Muscle Relaxant, Painkiller, and Seaweed Wrap are real incoming-combat Reactions", () => {
  const reactionIds = ["DDB-CON-CORE-005", "DDB-CON-CORE-016", "DDB-CON-CORE-036", "DDB-CON-CORE-041", "DDB-CON-CORE-047"];
  for (const id of reactionIds) {
    assert.equal(canPlayCoreConsumableInPhase(card(id), "defense-window", base), true, `${id} must be legal in the Defense Window`);
    assert.equal(canPlayCoreConsumableInPhase(card(id), "player-yell", base), false, `${id} must not be burned as a normal Yell action`);
  }
  for (const id of ["DDB-CON-CORE-005", "DDB-CON-CORE-036", "DDB-CON-CORE-041"]) {
    assert.ok(commands(id).some((command) => command.effect === "combat.preventDamage"), `${id} must arm damage prevention`);
  }
  for (const id of ["DDB-CON-CORE-016", "DDB-CON-CORE-047"]) {
    assert.ok(commands(id).some((command) => command.effect === "combat.modifyDefense"), `${id} must arm incoming-Attack DEF`);
  }
  assert.ok(playtestSource.includes("stage3cIncomingAttackDefenseBonus"));
  assert.ok(playtestSource.includes("stage3cTakeDamagePrevention"));
});

test("Fine-Print Fortune Cookie caps its reveal reward at exactly one or two Focus", () => {
  const low = commands("DDB-CON-CORE-020", "onPlay", { revealedFocusValue: 1 }).filter((command) => command.effect === "core.gainFocus");
  const high = commands("DDB-CON-CORE-020", "onPlay", { revealedFocusValue: 3 }).filter((command) => command.effect === "core.gainFocus");
  assert.ok(low.some((command) => command.amount === 1));
  assert.ok(high.some((command) => command.amount === 2));
  assert.equal(high.some((command) => command.amount > 2), false);
  assert.ok(playtestSource.includes("revealedFocusValue"));
});

test("Air Horn is recognized as a real cancel-Reaction event card and both player/AI surfaces are wired", () => {
  const airHorn = card("DDB-CON-CORE-001");
  assert.equal(firstEventReactionCard([airHorn], "cancel-reaction")?.catalogId, "DDB-CON-CORE-001");
  assert.ok(playtestSource.includes('firstEventReactionCard(current.ai.hand'));
  assert.ok(playtestSource.includes('pendingChoice: { kind: "cancel-reaction"'));
  assert.ok(playtestSource.includes("resolvePlayerAirHornChoice"));
  assert.ok(playtestSource.includes('choice.kind !== "cancel-reaction"'));
});
