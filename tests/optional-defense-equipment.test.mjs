import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { optionalCombatDamageReductionEquipment, postBlockEquipmentCycle } from "../app/effect-resolvers.ts";

const cards = JSON.parse(await readFile(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards;
const byName = new Map(cards.map((card) => [card.name, card]));

test("Fire-Code Padded Vest compiles as an optional first-combat-damage reaction", () => {
  const card = byName.get("Fire-Code Padded Vest");
  assert.ok(card, "canonical Fire-Code Padded Vest is present");
  assert.deepEqual(optionalCombatDamageReductionEquipment(card), { reduce: 1, readyAtHideMinBelt: "Green", readyAtHideMinDamage: 3 });
  assert.match(card.rulesText, /you may exhaust this to reduce that damage by 1/i);
});

test("Inspection-Grade Headgear compiles as a Blue+ High-Block optional cycle", () => {
  const card = byName.get("Inspection-Grade Headgear");
  assert.ok(card, "canonical Inspection-Grade Headgear is present");
  assert.deepEqual(postBlockEquipmentCycle(card), { minBelt: "Blue", zone: "High", draw: 1, discard: 1 });
});

test("Quick Duel pauses optional prevention before HP loss and preserves post-Block continuation", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /kind: "prevent-combat-damage"/);
  assert.match(source, /damageBeforeOptional/);
  assert.match(source, /optionalCombatDamagePlan\(current\.player\)/);
  assert.match(source, /combatDamageEventsThisRound/);
  assert.match(source, /readyAtHide/);
  assert.match(source, /kind: "post-block-cycle"/);
  assert.match(source, /pendingCombatContinuation/);
  assert.match(source, /resumeAfterDefense/);
});

test("optional defensive Equipment is not folded into mandatory Bubble Wrap prevention", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const mandatoryBody = source.slice(source.indexOf("function applyMandatoryEquipmentDamageReduction"), source.indexOf("function optionalCombatDamagePlan"));
  assert.doesNotMatch(mandatoryBody, /optionalCombatDamageReductionEquipment/);
  assert.match(source, /applyOptionalCombatDamageReductionAi/);
});
