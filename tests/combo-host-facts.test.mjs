import assert from "node:assert/strict";
import test from "node:test";
import {
  beginComboHostAscend,
  beginComboHostRound,
  beginComboHostTurn,
  closeComboHostTurn,
  comboRuntimeContextFromHostFacts,
  emptyComboHostFacts,
  recordComboHostAttack,
  recordComboHostBlock,
  recordComboHostCardPlayed,
  recordComboHostPurchase,
  recordComboHostSpeedGain,
} from "../app/combo-host-facts.ts";

const cards = new Map([
  ["junk-a", { id: "junk-a", name: "Junk A", cardType: "Junk", subtype: "Junk", tags: ["Junk"] }],
  ["junk-b", { id: "junk-b", name: "Junk B", cardType: "Junk", subtype: "Junk", tags: ["Junk"] }],
  ["kata", { id: "kata", name: "Kata", cardType: "Technique", subtype: "Kata", tags: ["Kata", "Stance"] }],
  ["attack", { id: "attack", name: "Attack", cardType: "Technique", subtype: "Attack", tags: ["Attack", "Punch"], zone: "Mid" }],
  ["defense", { id: "defense", name: "Defense", cardType: "Technique", subtype: "Defense", tags: ["Defense", "Dodge"] }],
  ["weapon", { id: "weapon", name: "Weapon", cardType: "Item", subtype: "Weapon", tags: ["Weapon", "Blade"] }],
]);
const lookup = (id) => cards.get(id);
const baseContext = {
  priorCards: [],
  attacksThisTurn: 0,
  defendedThisRound: false,
  blockedThisRound: false,
  hitThisTurn: false,
  hitZonesThisTurn: [],
  zonesPlayed: [],
  equipment: [],
  currentCard: cards.get("attack"),
  currentZone: "Mid",
  currentAttackHit: false,
  currentDefense: null,
  currentDefenseBlocked: false,
  completedBeltExamThisRound: false,
  triggeredComboIds: [],
};

test("host fact ledger publishes turn, round, since-last-turn, and since-last-Ascend facts generically", () => {
  let facts = beginComboHostRound(emptyComboHostFacts());
  facts = beginComboHostTurn(facts, ["junk-a", "junk-b", "attack"]);
  facts = recordComboHostCardPlayed(facts, "kata");
  facts = recordComboHostSpeedGain(facts);
  facts = recordComboHostAttack(facts, "attack", "Mid", { hit: true, reversal: true, blocked: false });
  facts = recordComboHostBlock(facts, "defense", "Low", 2);
  facts = beginComboHostAscend(facts);
  facts = recordComboHostPurchase(facts, "weapon");

  const context = comboRuntimeContextFromHostFacts(facts, baseContext, lookup);
  assert.deepEqual(context.startingHand.map((card) => card.id), ["junk-a", "junk-b", "attack"]);
  assert.ok(context.playedCardFacts.some((fact) => fact.window === "turn" && fact.card.id === "kata"));
  assert.ok(context.playedCardFacts.some((fact) => fact.window === "round" && fact.card.id === "kata"));
  assert.ok(context.playedCardFacts.some((fact) => fact.window === "sinceLastTurn" && fact.card.id === "kata"));
  assert.ok(context.attackFacts.some((fact) => fact.window === "sinceLastTurn" && fact.reversal && fact.hit));
  assert.ok(context.blockFacts.some((fact) => fact.window === "sinceLastTurn" && fact.incomingZone === "Low" && fact.defenseTags.includes("Dodge")));
  assert.deepEqual(context.speedGainWindows, ["sinceLastTurn"]);
  assert.ok(context.purchaseFacts.some((fact) => fact.window === "sinceLastAscend" && fact.tags.includes("Weapon")));
  assert.deepEqual(context.roundZonesPlayed, ["Mid"]);
  assert.equal(context.roundAttackHits, 1);
});

test("Hide closes since-last-turn history but leaves round history intact", () => {
  let facts = emptyComboHostFacts();
  facts = recordComboHostCardPlayed(facts, "kata");
  facts = recordComboHostAttack(facts, "attack", "Mid", { hit: false, blocked: true });
  facts = recordComboHostBlock(facts, "defense", "Mid");
  facts = recordComboHostSpeedGain(facts);
  facts = closeComboHostTurn(facts);

  const context = comboRuntimeContextFromHostFacts(facts, baseContext, lookup);
  assert.equal(context.playedCardFacts.some((fact) => fact.window === "sinceLastTurn"), false);
  assert.equal(context.attackFacts.some((fact) => fact.window === "sinceLastTurn"), false);
  assert.equal(context.blockFacts.some((fact) => fact.window === "sinceLastTurn"), false);
  assert.deepEqual(context.speedGainWindows, []);
  assert.ok(context.playedCardFacts.some((fact) => fact.window === "round" && fact.card.id === "kata"));
  assert.ok(context.attackFacts.some((fact) => fact.window === "round" && fact.blocked));
});

test("new turn captures a fresh starting hand without erasing opponent-turn since-last-turn facts", () => {
  let facts = closeComboHostTurn(emptyComboHostFacts());
  facts = recordComboHostBlock(facts, "defense", "High");
  facts = beginComboHostTurn(facts, ["junk-a", "attack"]);
  const context = comboRuntimeContextFromHostFacts(facts, baseContext, lookup);
  assert.deepEqual(context.startingHand.map((card) => card.id), ["junk-a", "attack"]);
  assert.ok(context.blockFacts.some((fact) => fact.window === "sinceLastTurn" && fact.incomingZone === "High"));
});
