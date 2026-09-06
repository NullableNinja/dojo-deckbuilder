import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyDefenseRuntime,
  defenseRuntimeCommands,
  isSupportedDefenseResolver,
  structuredDefenseGuardBonus,
} from "../app/defense-effect-resolvers.ts";
import {
  applyConsumableRuntime,
  consumableRuntimeCommands,
  isSupportedConsumableResolver,
  structuredConsumableDestroysAfterUse,
  structuredConsumableNextAttackPenalty,
} from "../app/consumable-effect-resolvers.ts";
import { createFamilyRuntimeState } from "../app/family-effect-runtime.ts";
import { effectPlanForCard } from "../app/card-effects.ts";

const defenseFamily = JSON.parse(await readFile(new URL("../content/card-effects/defenses.json", import.meta.url), "utf8"));
const consumableFamily = JSON.parse(await readFile(new URL("../content/card-effects/consumables.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const defenses = defenseFamily.cards ?? {};
const consumables = consumableFamily.cards ?? {};

const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId) ?? { catalogId };

function resolverFailures(registry, supported) {
  const failures = [];
  for (const [catalogId, entry] of Object.entries(registry)) {
    for (const effect of entry.effects ?? []) {
      if (effect.resolver && !supported(effect.resolver)) failures.push(`${catalogId}:${effect.id}:${effect.resolver}`);
    }
  }
  return failures;
}

test("every dedicated Defense and Consumable resolver has a Stage 3C implementation", () => {
  assert.deepEqual(resolverFailures(defenses, isSupportedDefenseResolver), []);
  assert.deepEqual(resolverFailures(consumables, isSupportedConsumableResolver), []);
});

test("effect coverage reports migrated Defense and Consumable resolvers as executable instead of queued", () => {
  const failures = [];
  for (const entry of cards.filter((entry) => /^DDB-(DEF|CON)-CORE-/.test(String(entry.catalogId ?? "")))) {
    const plan = effectPlanForCard(entry);
    if (plan.unsupported.length) failures.push(`${entry.catalogId}:${plan.unsupported.join(",")}`);
  }
  assert.deepEqual(failures, []);
});

test("After-Hours Counterform conditional Guard is driven by structured context", () => {
  const counterform = card("DDB-DEF-CORE-002");
  assert.equal(structuredDefenseGuardBonus(counterform, { defenderAttackedThisRound: false }).amount, 0);
  assert.equal(structuredDefenseGuardBonus(counterform, { defenderAttackedThisRound: true }).amount, 1);
});

test("Double Forearm Guard respects the incoming Attack Power threshold", () => {
  const guard = card("DDB-DEF-CORE-012");
  assert.equal(structuredDefenseGuardBonus(guard, { incomingAttackPower: 7 }).amount, 0);
  assert.equal(structuredDefenseGuardBonus(guard, { incomingAttackPower: 8 }).amount, 1);
});

test("Defense on-Block commands mutate runtime state", () => {
  const accordion = card("DDB-DEF-CORE-001");
  const commands = defenseRuntimeCommands(accordion, "onBlock", { blockSucceeded: true });
  assert.ok(commands.some((command) => command.effect === "core.draw" && command.amount === 1));
  assert.ok(commands.some((command) => command.effect === "core.discard" && command.amount === 1));
  const state = applyDefenseRuntime(createFamilyRuntimeState(), accordion, "onBlock", { blockSucceeded: true });
  assert.equal(state.self.draw, 1);
  assert.equal(state.self.discard, 1);
});

test("Consumable immediate and end-of-round effects preserve timing semantics", () => {
  const mochi = card("DDB-CON-CORE-006");
  const state = applyConsumableRuntime(createFamilyRuntimeState(), mochi, "onPlay");
  assert.equal(state.self.draw, 2);
  assert.equal(state.self.speed, 0);
  assert.ok(state.statuses.some((status) => status.effect === "combat.modifySpeed" && status.amount === -1 && status.duration === "endOfRound"));
});

test("Consumable delayed attack modifiers persist with the intended timing qualifier", () => {
  const gloves = card("DDB-CON-CORE-004");
  const commands = consumableRuntimeCommands(gloves, "onPlay");
  const attack = commands.find((command) => command.effect === "combat.modifyAttackPower");
  assert.equal(attack?.amount, 2);
  assert.equal(attack?.duration, "nextAttack");
  assert.equal(attack?.qualifier?.nextAttackTag, "Unarmed");
  const state = applyConsumableRuntime(createFamilyRuntimeState(), gloves, "onPlay");
  assert.equal(state.statuses.length, 1);
  assert.equal(state.statuses[0].duration, "nextAttack");
});

test("Consumable destroy-after-use and opponent next-Attack penalty helpers use structured registry semantics", () => {
  assert.equal(structuredConsumableDestroysAfterUse(card("DDB-CON-CORE-007")), true);
  assert.equal(structuredConsumableNextAttackPenalty(card("DDB-CON-CORE-002")), 2);
});
