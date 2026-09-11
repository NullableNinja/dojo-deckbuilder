import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { comboPlanForHost } from "../app/combo-playtest-bridge.ts";
import { evaluateCombo } from "../app/combo-engine.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const effects = JSON.parse(await readFile(new URL("../content/card-effects/combos.json", import.meta.url), "utf8")).cards ?? {};
const requirements = JSON.parse(await readFile(new URL("../content/combo-requirements.json", import.meta.url), "utf8")).cards ?? {};
const bridgeSource = await readFile(new URL("../app/combo-playtest-bridge.ts", import.meta.url), "utf8");
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);
const attack = (id = "attack", tags = [], zone = "Mid") => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const defense = (id = "defense", tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Defense", tags, zone: "Mid" });

function baseContext(currentCard = attack()) {
  return {
    priorCards: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
    hitZonesThisTurn: [],
    zonesPlayed: [],
    equipment: [],
    currentCard,
    currentZone: String(currentCard.zone ?? "Mid"),
    currentAttackHit: false,
    currentDefense: null,
    currentDefenseBlocked: false,
    completedBeltExamThisRound: false,
    triggeredComboIds: [],
  };
}

test("all 55 Core Combos have complete host plans covering every canonical effect", () => {
  const ids = Object.keys(effects).sort();
  assert.equal(ids.length, 55);
  assert.deepEqual(Object.keys(requirements).sort(), ids);
  for (const id of ids) {
    const combo = card(id);
    assert.ok(combo, id);
    const plan = comboPlanForHost(combo, baseContext());
    assert.deepEqual(plan.canonicalEffectIds.slice().sort(), (effects[id].effects ?? []).map((effect) => effect.id).sort(), `${id} canonical effect inventory`);
    assert.deepEqual(plan.unsupportedEffectIds, [], `${id} must expose every canonical effect through a host command/deferred command/choice`);
    assert.deepEqual(plan.coveredEffectIds, plan.canonicalEffectIds.slice().sort(), `${id} host plan coverage`);
  }
});

test("Combo host planning never parses printed requirement or payoff prose", () => {
  assert.doesNotMatch(bridgeSource, /rulesText|Requirement:|Payoff:|match\s*\(|\.match\s*\(/);
  assert.match(bridgeSource, /evaluateStructuredComboRequirements/);
  assert.match(bridgeSource, /comboCommandsForTrigger/);
  assert.match(bridgeSource, /comboDeferredCommandsOnCompletion/);
});

test("deferred Combo effects remain explicit host statuses instead of collapsing into attack math", () => {
  const nextReaction = comboPlanForHost(card("DDB-CMB-CORE-013"), baseContext());
  assert.deepEqual(nextReaction.deferredOnCompletion.map((command) => command.sourceEffectId).sort(), [
    "combo-comment-period-guard-penalty",
    "combo-comment-period-power-penalty",
  ]);
  assert.ok(nextReaction.deferredOnCompletion.every((command) => command.qualifier?.nextReaction));

  const nextInitiate = comboPlanForHost(card("DDB-CMB-CORE-017"), { ...baseContext(defense("guard", ["Guard"])), defendedThisRound: true, currentDefense: defense("guard", ["Guard"]), currentDefenseBlocked: true }, "onBlock");
  assert.equal(nextInitiate.deferredOnCompletion[0]?.duration, "nextInitiate");
  assert.equal(nextInitiate.deferredOnCompletion[0]?.qualifier?.activateAt, "nextInitiate");

  const nextTurn = comboPlanForHost(card("DDB-CMB-CORE-028"), { ...baseContext(), defendedThisRound: true }, "onBlock");
  assert.equal(nextTurn.deferredOnCompletion[0]?.duration, "nextAttack");
  assert.equal(nextTurn.deferredOnCompletion[0]?.qualifier?.nextTurn, true);
});

test("Weapon-discard Combo exposes one generic choice with structured follow-up commands", () => {
  const plan = comboPlanForHost(card("DDB-CMB-CORE-022"), baseContext());
  assert.equal(plan.choice?.kind, "chooseCard");
  assert.equal(plan.choice?.resolver, "combo.discardWeaponChoice");
  assert.deepEqual(plan.choice?.filter, { tag: "Weapon" });
  assert.deepEqual(plan.choice?.followupEffectIds, ["combo-improvised-curriculum-power"]);
  assert.ok(plan.coveredEffectIds.includes("combo-improvised-curriculum-choice"));
  assert.ok(plan.coveredEffectIds.includes("combo-improvised-curriculum-power"));
});

test("draw/discard/Focus and on-Hit Combo payoffs are preserved as complete commands", () => {
  const plan = comboPlanForHost(card("DDB-CMB-CORE-036"), baseContext());
  const onHit = plan.commandsByTrigger.onHit ?? [];
  assert.deepEqual(onHit.map((command) => [command.effect, command.amount]).sort(), [
    ["core.discard", 1],
    ["core.draw", 1],
    ["core.gainFocus", 1],
  ].sort());
});

test("Core evaluateCombo exposes the complete structured plan at the existing Quick Duel boundary", () => {
  const combo = card("DDB-CMB-CORE-004");
  const prior = attack("prior", ["Multi-Hit"], "Mid");
  const current = attack("current", [], "High");
  const result = evaluateCombo(combo, {
    ...baseContext(current),
    priorCards: [prior],
    attacksThisTurn: 1,
    zonesPlayed: ["Mid"],
    currentZone: "High",
  });
  assert.equal(result.eligible, true);
  assert.ok(result.structuredPlan);
  assert.deepEqual(result.structuredPlan.unsupportedEffectIds, []);
  assert.ok((result.structuredPlan.commandsByTrigger.onAttackDeclared ?? []).some((command) => command.effect === "combat.modifyAttackPower"));
  assert.ok((result.structuredPlan.commandsByTrigger.onAttackDeclared ?? []).some((command) => command.effect === "combat.grantFlow"));
});
