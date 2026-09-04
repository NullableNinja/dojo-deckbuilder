import assert from "node:assert/strict";
import test from "node:test";
import { comboRequirementText, evaluateCombo } from "../app/combo-engine.ts";

const attack = (name, tags = [], zone = "Mid") => ({ id: name, name, cardType: "Technique", subtype: "Attack", tags, zone, details: {} });

test("Combo evaluator reads the dedicated Sequence / Requirement field", () => {
  const combo = { id: "c1", name: "Blitzed Expectations", tags: ["Multi-Hit"], rulesText: "The final Attack gets +1 Attack Power and gains Flow.", details: { "Sequence / Requirement": "Multi-Hit Attack → any Attack", Effect: "The final Attack gets +1 Attack Power and gains Flow." } };
  assert.equal(comboRequirementText(combo), "Multi-Hit Attack → any Attack");
  const result = evaluateCombo(combo, { priorCards: [attack("Blitz", ["Multi-Hit"])], attacksThisTurn: 1, defendedThisRound: false, hitThisTurn: false, zonesPlayed: ["Mid"], equipment: [], currentCard: attack("Jab"), currentZone: "High" });
  assert.equal(result.eligible, true);
  assert.equal(result.power, 1);
  assert.equal(result.grantsFlow, true);
});

test("Combo evaluator enforces a different-zone finisher", () => {
  const combo = { id: "c2", name: "Bird Law", tags: ["Jump", "Kick"], rulesText: "If the Jump Attack Hit, the finishing Kick gets +2 Attack Power and you gain +2 Speed until end of round.", details: { "Sequence / Requirement": "Jump Attack → Kick in a different Zone", Effect: "If the Jump Attack Hit, the finishing Kick gets +2 Attack Power and you gain +2 Speed until end of round." } };
  const base = { priorCards: [attack("Jump", ["Jump"], "High")], attacksThisTurn: 1, defendedThisRound: false, hitThisTurn: true, zonesPlayed: ["High"], equipment: [], currentCard: attack("Kick", ["Kick"], "Low") };
  assert.equal(evaluateCombo(combo, { ...base, currentZone: "Low" }).eligible, true);
  assert.equal(evaluateCombo(combo, { ...base, currentZone: "High" }).eligible, false);
  assert.equal(evaluateCombo(combo, { ...base, currentZone: "Low" }).speedOnTrigger, 2);
});

test("Combo evaluator does not pretend an unsupported payoff works", () => {
  const combo = { id: "c3", name: "Piercing Filing", tags: ["Block"], rulesText: "Requirement: Block an Attack, then make a Weapon Attack. Payoff: That Attack gets Piercing 1.", details: {} };
  const result = evaluateCombo(combo, { priorCards: [], attacksThisTurn: 0, defendedThisRound: true, hitThisTurn: false, zonesPlayed: [], equipment: [], currentCard: attack("Weapon hit", ["Weapon"]), currentZone: "Mid" });
  assert.equal(result.supported, false);
  assert.equal(result.eligible, false);
});
