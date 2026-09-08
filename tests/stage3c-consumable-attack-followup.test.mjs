import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { armConsumableAttackFollowupStatuses, isConsumableAttackFollowupStatus, resolveConsumableAttackFollowupStatuses } from "../app/stage3c-consumable-attack-followup.ts";

const cards = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8")).cards ?? [];
const card = (catalogId) => cards.find((entry) => entry.catalogId === catalogId);

test("Mystery Dojo Jerky arms one watched Attack and deals backlash only when Blocked", () => {
  const armed = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-037"));
  assert.equal(armed.filter(isConsumableAttackFollowupStatus).length, 1);
  const blocked = resolveConsumableAttackFollowupStatuses(armed, { blocked: true });
  assert.equal(blocked.directSelfDamage, 1);
  assert.equal(blocked.focus, 0);
  assert.equal(blocked.statuses.some(isConsumableAttackFollowupStatus), false);
  const hit = resolveConsumableAttackFollowupStatuses(armed, { blocked: false });
  assert.equal(hit.directSelfDamage, 0);
  assert.equal(hit.statuses.some(isConsumableAttackFollowupStatus), false);
});

test("Pocket Yoyo awards its structured payoff when the watched Attack is still Blocked", () => {
  const armed = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-062"));
  assert.equal(armed.filter(isConsumableAttackFollowupStatus).length, 1);
  const blocked = resolveConsumableAttackFollowupStatuses(armed, { blocked: true });
  assert.equal(blocked.focus, 1);
  assert.equal(blocked.statuses.some(isConsumableAttackFollowupStatus), false);
  const hit = resolveConsumableAttackFollowupStatuses(armed, { blocked: false });
  assert.equal(hit.focus, 0);
  assert.equal(hit.statuses.some(isConsumableAttackFollowupStatus), false);
});

test("Rubber Chicken awards the after-Attack Focus only when no Interfere was prevented", () => {
  const armed = armConsumableAttackFollowupStatuses([], card("DDB-CON-CORE-046"));
  assert.equal(armed.filter(isConsumableAttackFollowupStatus).length, 1);
  const clear = resolveConsumableAttackFollowupStatuses(armed, { blocked: false, interferencePrevented: false });
  assert.equal(clear.focus, 1);
  assert.equal(clear.statuses.some(isConsumableAttackFollowupStatus), false);
  const prevented = resolveConsumableAttackFollowupStatuses(armed, { blocked: false, interferencePrevented: true });
  assert.equal(prevented.focus, 0);
  assert.equal(prevented.statuses.some(isConsumableAttackFollowupStatus), false);
});

test("attack-followup watchers coexist with ordinary next-Attack statuses until resolution", () => {
  const ordinary = { sourceEffectId: "ordinary", effect: "combat.modifyAttackPower", target: "self", amount: 2, duration: "nextAttack", qualifier: { expires: "endOfTurn" }, appliedImmediately: false };
  const armed = armConsumableAttackFollowupStatuses([ordinary], card("DDB-CON-CORE-037"));
  assert.equal(armed.some((status) => status.sourceEffectId === "ordinary"), true);
  assert.equal(armed.some(isConsumableAttackFollowupStatus), true);
  const resolved = resolveConsumableAttackFollowupStatuses(armed, { blocked: true });
  assert.equal(resolved.statuses.some((status) => status.sourceEffectId === "ordinary"), true, "followup resolution must not consume unrelated next-Attack state");
  assert.equal(resolved.statuses.some(isConsumableAttackFollowupStatus), false, "the watched-Attack followup itself is one-shot");
});
