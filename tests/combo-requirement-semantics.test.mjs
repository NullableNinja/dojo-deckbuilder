import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateStructuredComboRequirements } from "../app/combo-runtime.ts";

const requirements = JSON.parse(await readFile(new URL("../content/combo-requirements.json", import.meta.url), "utf8")).cards ?? {};

const attack = (id, tags = [], zone = "Mid") => ({ id, name: id, cardType: "Technique", subtype: "Attack", tags, zone });
const kata = (id, tags = [], focusValue = 1) => ({ id, name: id, cardType: "Technique", subtype: "Kata", tags, focusValue });
const consumable = (id) => ({ id, name: id, cardType: "Item", subtype: "Consumable", tags: ["Consumable"] });
const defense = (id, tags = []) => ({ id, name: id, cardType: "Technique", subtype: "Defense", tags });
const weapon = (id, tags = []) => ({ id, name: id, cardType: "Item", subtype: "Weapon", tags: ["Weapon", ...tags] });
const combo = (catalogId) => ({ id: catalogId, name: requirements[catalogId]?.name ?? catalogId, catalogId, cardType: "Combo", subtype: "Combo", tags: [] });

function context(currentCard, overrides = {}) {
  return {
    priorCards: [],
    attacksThisTurn: 0,
    defendedThisRound: false,
    blockedThisRound: false,
    hitThisTurn: false,
    hitZonesThisTurn: [],
    zonesPlayed: [],
    roundZonesPlayed: [],
    roundAttackHits: 0,
    equipment: [],
    startingHand: [],
    currentCard,
    currentZone: currentCard.zone ?? "Mid",
    currentAttackHit: false,
    currentDefense: null,
    currentDefenseBlocked: false,
    completedBeltExamThisRound: false,
    triggeredComboIds: [],
    previousAttackBlocked: false,
    blockFacts: [],
    speedGainWindows: [],
    purchaseFacts: [],
    playedCardFacts: [],
    attackFacts: [],
    ...overrides,
  };
}

const eligible = (id, ctx) => evaluateStructuredComboRequirements(combo(id), ctx).eligible;

test("canonical Combo requirements contain no empty wildcard sequence steps", () => {
  for (const [id, entry] of Object.entries(requirements)) {
    for (const requirement of entry.requirements ?? []) {
      for (const step of requirement.steps ?? []) {
        assert.ok(Object.keys(step).length > 0, `${id} contains an empty sequence step`);
      }
    }
  }
});

test("Empty Hands, Full Problems requires no Weapon and a Kata into Hand Attack", () => {
  const current = attack("hand", ["Hand"], "Mid");
  const base = context(current, { priorCards: [kata("setup")], attacksThisTurn: 0 });
  assert.equal(eligible("DDB-CMB-CORE-015", base), true);
  assert.equal(eligible("DDB-CMB-CORE-015", { ...base, equipment: [weapon("staff", ["Staff"])] }), false);
});

test("Pocket Snack Tactics requires an actual Consumable before the Low Attack", () => {
  const current = attack("low", [], "Low");
  assert.equal(eligible("DDB-CMB-CORE-034", context(current, { priorCards: [consumable("snack")], currentZone: "Low" })), true);
  assert.equal(eligible("DDB-CMB-CORE-034", context(current, { priorCards: [kata("not-a-consumable")], currentZone: "Low" })), false);
});

test("The Full Tax Audit requires all three zones and at least two Hits", () => {
  const current = attack("low", [], "Low");
  const base = context(current, {
    priorCards: [attack("high", [], "High"), attack("mid", [], "Mid")],
    attacksThisTurn: 2,
    zonesPlayed: ["High", "Mid"],
    hitZonesThisTurn: ["High"],
    currentZone: "Low",
    currentAttackHit: true,
  });
  assert.equal(eligible("DDB-CMB-CORE-046", base), true);
  assert.equal(eligible("DDB-CMB-CORE-046", { ...base, currentAttackHit: false }), false);
});

test("Purchase Order of Pain requires a Weapon purchase and a Hit with a Weapon Attack", () => {
  const current = attack("weapon-hit", ["Weapon"], "Mid");
  const base = context(current, {
    currentAttackHit: true,
    purchaseFacts: [{ window: "sinceLastAscend", tags: ["Weapon"], family: "Equipment" }],
  });
  assert.equal(eligible("DDB-CMB-CORE-036", base), true);
  assert.equal(eligible("DDB-CMB-CORE-036", { ...base, purchaseFacts: [] }), false);
  assert.equal(eligible("DDB-CMB-CORE-036", { ...base, currentAttackHit: false }), false);
});

test("Comment Period Closed requires a Defense since last turn plus a Mid Hit", () => {
  const current = attack("mid", [], "Mid");
  const base = context(current, {
    currentAttackHit: true,
    playedCardFacts: [{ window: "sinceLastTurn", card: defense("guard", ["Guard"]) }],
  });
  assert.equal(eligible("DDB-CMB-CORE-013", base), true);
  assert.equal(eligible("DDB-CMB-CORE-013", { ...base, playedCardFacts: [] }), false);
});

test("Wrong Door, Right Elbow requires a prior Reversal Hit and a current Mid Attack", () => {
  const current = attack("mid", [], "Mid");
  const reversal = attack("reversal", ["Hand"], "High");
  const base = context(current, {
    attackFacts: [{ window: "sinceLastTurn", card: reversal, zone: "High", hit: true, reversal: true }],
  });
  assert.equal(eligible("DDB-CMB-CORE-054", base), true);
  assert.equal(eligible("DDB-CMB-CORE-054", { ...base, attackFacts: [{ window: "sinceLastTurn", card: reversal, zone: "High", hit: true, reversal: false }] }), false);
});

test("Two Sticks, No Plan requires a two-Weapon setup and two Attacks", () => {
  const current = attack("second", [], "Low");
  const base = context(current, {
    priorCards: [attack("first", [], "High")],
    attacksThisTurn: 1,
    zonesPlayed: ["High"],
    equipment: [weapon("left", ["Paired"]), weapon("right", ["Paired"])],
  });
  assert.equal(eligible("DDB-CMB-CORE-051", base), true);
  assert.equal(eligible("DDB-CMB-CORE-051", { ...base, equipment: [weapon("left", ["Paired"])] }), false);
});

test("Sweep Dreams accepts either a Sweep or a Low Kick before the High Attack", () => {
  const current = attack("high", [], "High");
  assert.equal(eligible("DDB-CMB-CORE-045", context(current, { priorCards: [attack("sweep", ["Sweep"], "Mid")], zonesPlayed: ["Mid"], currentZone: "High" })), true);
  assert.equal(eligible("DDB-CMB-CORE-045", context(current, { priorCards: [attack("low-kick", ["Kick"], "Low")], zonesPlayed: ["Low"], currentZone: "High" })), true);
  assert.equal(eligible("DDB-CMB-CORE-045", context(current, { priorCards: [attack("jab", ["Punch"], "Mid")], zonesPlayed: ["Mid"], currentZone: "High" })), false);
});
