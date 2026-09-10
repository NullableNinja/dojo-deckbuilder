import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCharacterRuntimeEvent,
  characterPurchasePrice,
  resetCharacterRound,
  resetCharacterTurn,
} from "../app/character-runtime.ts";
import {
  structuredLocationAttackModifiers,
  structuredLocationHealingModifier,
  structuredLocationPurchaseCostModifier,
} from "../app/location-effect-resolvers.ts";
import {
  locationRuntimeDelta,
  resetLocationRound,
  resetLocationScene,
  resetLocationTurn,
} from "../app/location-runtime.ts";
import { resolveLocationHostEvent } from "../app/location-playtest-bridge.ts";

function board(fighterId, overrides = {}) {
  return {
    fighterId,
    belt: 3,
    hp: 20,
    maxHp: 25,
    xp: 0,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackAnyZone: false,
    nextAttackHasFlow: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: [],
    exhaustedEquipment: [],
    hand: ["h1", "h2"],
    deck: ["d1", "d2"],
    discard: [],
    destroyed: [],
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    nextInitiateFocus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    locationUsedEffectsThisTurn: [],
    locationUsedEffectsThisRound: [],
    locationUsedEffectsThisScene: [],
    locationNextRoundSpeed: 0,
    ...overrides,
  };
}

const attack = (tags = [], zone = "High") => ({ id: "attack", cardType: "Attack", subtype: "Attack", tags, zone });

test("Location purchase pricing applies before Character pricing and both canonical floors survive", () => {
  const location = structuredLocationPurchaseCostModifier(
    { catalogId: "DDB-LOC-CORE-011" },
    { cardTypeAny: ["Item"], firstMatchingPerTurn: true },
  );
  assert.equal(location.amount, -1);
  assert.equal(location.minimum, 1);
  const afterLocation = Math.max(location.minimum, 7 + location.amount);
  assert.equal(afterLocation, 6);
  assert.equal(characterPurchasePrice(board("DDB-CHR-CORE-006"), afterLocation), 5);
  assert.equal(characterPurchasePrice(board("DDB-CHR-CORE-006"), 4), 4);
});

test("Character and Location Attack modifiers compose additively rather than replacing each other", () => {
  const self = board("DDB-CHR-CORE-012", { usedConsumableThisRound: true });
  const character = applyCharacterRuntimeEvent(
    self,
    board("DDB-CHR-CORE-001"),
    { type: "attackDeclared", card: attack(), firstAttackThisTurn: true, usedConsumableThisTurn: true, attackPower: 2 },
    "ai",
  );
  const location = structuredLocationAttackModifiers(
    { catalogId: "DDB-LOC-CORE-030" },
    { firstAttackThisTurn: true, attackZone: "High", attackTagAny: [], equipmentTagAny: [] },
  );
  assert.equal(character.event.attackPower, 3);
  assert.equal(location.power, -1);
  assert.equal(character.event.attackPower + location.power, 2);
});

test("Character damage prevention and Location healing remain independent state transitions", () => {
  const character = applyCharacterRuntimeEvent(
    board("DDB-CHR-CORE-031", { hp: 18 }),
    board("DDB-CHR-CORE-001"),
    { type: "damageIncoming", damage: 3 },
    "ai",
  );
  const location = structuredLocationHealingModifier(
    { catalogId: "DDB-LOC-CORE-017" },
    { healingSourceAny: ["Consumable"] },
  );
  assert.equal(character.event.damage, 2);
  assert.equal(location.amount, 2);
  const hpAfterDamage = character.self.hp - character.event.damage;
  const hpAfterHeal = Math.min(character.self.maxHp, hpAfterDamage + 1 + location.amount);
  assert.equal(hpAfterHeal, 19);
});

test("human Character and Location choices can coexist without consuming one another", () => {
  const character = applyCharacterRuntimeEvent(
    board("DDB-CHR-CORE-003"),
    board("DDB-CHR-CORE-001"),
    { type: "incomingAttackDeclared", attackPower: 5 },
    "player",
  );
  const location = resolveLocationHostEvent(
    { catalogId: "DDB-LOC-CORE-031" },
    {},
    "block",
    { incomingAttackZone: "Low", firstMatchingPerRound: true },
  );
  assert.equal(character.choices.length, 1);
  assert.equal(character.event.attackPower, 5, "unresolved human Character choice must not auto-apply");
  assert.equal(location.delta.choices.length, 1);
  assert.equal(location.delta.choices[0].operation, "readyEquipmentOrSpeedChoice");
});

test("AI resolves Character choices from the same legal state while Location choice remains structured", () => {
  const ai = applyCharacterRuntimeEvent(
    board("DDB-CHR-CORE-024"),
    board("DDB-CHR-CORE-001"),
    { type: "initiate", hasWeaponEquipped: false },
    "ai",
  );
  const player = applyCharacterRuntimeEvent(
    board("DDB-CHR-CORE-024"),
    board("DDB-CHR-CORE-001"),
    { type: "initiate", hasWeaponEquipped: false },
    "player",
  );
  assert.equal(player.choices.length, 1);
  assert.deepEqual(player.choices[0].options, ["attack", "defense"]);
  assert.equal(ai.choices.length, 0);
  assert.equal(ai.self.nextAttackBonus, 1);

  const location = resolveLocationHostEvent(
    { catalogId: "DDB-LOC-CORE-031" },
    {},
    "block",
    { incomingAttackZone: "Low", firstMatchingPerRound: true },
  );
  assert.deepEqual(location.delta.choices[0].metadata.choiceOptions, ["ready-equipment", "speed+1-nextHonor"]);
});

test("Scene replacement clears Location scene state without erasing Character delayed state", () => {
  const initial = board("DDB-CHR-CORE-002", {
    nextAttackAnyZone: true,
    characterMarks: { "round:carry": true },
    usedCharacterEffectIdsThisRound: ["character-round"],
    locationUsedEffectsThisScene: ["location-scene"],
    locationUsedEffectsThisRound: ["location-round"],
  });
  const changed = resetLocationScene(initial);
  assert.deepEqual(changed.locationUsedEffectsThisScene, []);
  assert.deepEqual(changed.locationUsedEffectsThisRound, ["location-round"]);
  assert.equal(changed.nextAttackAnyZone, true);
  assert.equal(changed.characterMarks["round:carry"], true);
  assert.deepEqual(changed.usedCharacterEffectIdsThisRound, ["character-round"]);
});

test("turn and round cleanup reset each family only at its own lifecycle boundary", () => {
  const initial = board("DDB-CHR-CORE-014", {
    tempSpeed: 0,
    characterMarks: { "turn:attack": true, "round:guard": true, "game:once": true },
    usedCharacterEffectIdsThisTurn: ["character-turn"],
    usedCharacterEffectIdsThisRound: ["character-round"],
    usedCharacterEffectIdsThisGame: ["character-game"],
    locationUsedEffectsThisTurn: ["location-turn"],
    locationUsedEffectsThisRound: ["location-round"],
    locationUsedEffectsThisScene: ["location-scene"],
    locationNextRoundSpeed: -2,
  });

  const afterTurn = resetLocationTurn(resetCharacterTurn(initial));
  assert.deepEqual(afterTurn.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(afterTurn.usedCharacterEffectIdsThisRound, ["character-round"]);
  assert.deepEqual(afterTurn.locationUsedEffectsThisTurn, []);
  assert.deepEqual(afterTurn.locationUsedEffectsThisRound, ["location-round"]);

  const afterRound = resetLocationRound(resetCharacterRound(afterTurn));
  assert.deepEqual(afterRound.usedCharacterEffectIdsThisRound, []);
  assert.deepEqual(afterRound.usedCharacterEffectIdsThisGame, ["character-game"]);
  assert.equal(afterRound.characterMarks["game:once"], true);
  assert.deepEqual(afterRound.locationUsedEffectsThisRound, []);
  assert.equal(afterRound.locationNextRoundSpeed, 0);
  assert.equal(afterRound.tempSpeed, -2);
});

test("Location runtime choices do not mutate Character usage bookkeeping", () => {
  const initial = board("DDB-CHR-CORE-001", { usedCharacterEffectIdsThisRound: ["character-auntie-parry-reversal-power"] });
  const location = resolveLocationHostEvent(
    { catalogId: "DDB-LOC-CORE-031" },
    initial,
    "block",
    { incomingAttackZone: "Low", firstMatchingPerRound: true },
  );
  assert.equal(locationRuntimeDelta(location.delta.commands).choices.length, 1);
  assert.deepEqual(location.state.usedCharacterEffectIdsThisRound, ["character-auntie-parry-reversal-power"]);
  assert.ok(location.state.locationUsedEffectsThisRound.includes("location-031-first-low-block-choice"));
});
