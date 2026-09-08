import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { armConsumableHideStatuses, isConsumableHideStatus, resolveConsumableHideStatuses } from "../app/stage3c-consumable-hide-followup.ts";
import { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);

test("Expired Protein Shake persists its 2 direct Hide damage after leaving the play area", () => {
  const armed = armConsumableHideStatuses([], card("DDB-CON-CORE-019"));
  assert.equal(armed.filter(isConsumableHideStatus).length, 1);
  const resolved = resolveConsumableHideStatuses(armed);
  assert.equal(resolved.directSelfDamage, 2);
  assert.equal(resolved.statuses.some(isConsumableHideStatus), false);
});

test("Overtime Espresso persists its 1 HP Hide loss after leaving the play area", () => {
  const armed = armConsumableHideStatuses([], card("DDB-CON-CORE-040"));
  assert.equal(armed.filter(isConsumableHideStatus).length, 1);
  assert.equal(resolveConsumableHideStatuses(armed).directSelfDamage, 1);
});

test("Warranty-Approved Ice Pop bonus is driven by Reaction Item history context", () => {
  const noReaction = consumableRuntimeCommands(card("DDB-CON-CORE-058"), "onPlay", { reactionItemUsedSinceLastTurn: false, friendlyTargetCount: 1 });
  const afterReaction = consumableRuntimeCommands(card("DDB-CON-CORE-058"), "onPlay", { reactionItemUsedSinceLastTurn: true, friendlyTargetCount: 1 });
  assert.equal(noReaction.filter((command) => command.effect === "core.heal").reduce((sum, command) => sum + command.amount, 0), 4);
  assert.equal(afterReaction.filter((command) => command.effect === "core.heal").reduce((sum, command) => sum + command.amount, 0), 6);
});
