import assert from "node:assert/strict";
import test from "node:test";
import { requiredCharacterHostEvents } from "../app/character-playtest-bridge.ts";
import { QUICK_DUEL_CHARACTER_EVENT_ROUTES, quickDuelCharacterEventCoverage } from "../app/quick-duel-character-event-routes.ts";

test("every canonical Character host event has exactly one Quick Duel publication route", () => {
  const required = [...requiredCharacterHostEvents()].sort();
  const routed = QUICK_DUEL_CHARACTER_EVENT_ROUTES.map((route) => route.event).sort();
  assert.deepEqual(routed, required);
  assert.equal(new Set(routed).size, routed.length);
  assert.deepEqual(quickDuelCharacterEventCoverage().missing, []);
});

test("events that can change legality, cost, damage, or declaration resolve before the host commits state", () => {
  const preAction = new Set(QUICK_DUEL_CHARACTER_EVENT_ROUTES.filter((route) => route.timing === "pre-action").map((route) => route.event));
  for (const event of ["attackDeclared", "incomingAttackDeclared", "damageIncoming", "equip", "comboReveal", "purchaseAttempt", "sceneChange"]) {
    assert.ok(preAction.has(event), `${event} must publish before irreversible host resolution`);
  }
});

test("Character event routes are generic host facts, not fighter/card identity dispatch", () => {
  const serialized = JSON.stringify(QUICK_DUEL_CHARACTER_EVENT_ROUTES);
  assert.doesNotMatch(serialized, /DDB-CHR-CORE-|Auntie Parry|Baron von Backflip|Sensei Ducktape/i);
  for (const route of QUICK_DUEL_CHARACTER_EVENT_ROUTES) {
    assert.ok(route.hostFact.length > 0);
    assert.ok(route.reason.length > 0);
  }
});
