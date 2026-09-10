import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  characterHostAttackModifier,
  characterHostAttackZones,
  characterHostCanEquip,
  characterHostDamageReduction,
  characterHostPurchasePrice,
  resetCharacterHostRound,
  resetCharacterHostTurn,
  resolveCharacterHostEvent,
} from "../app/character-playtest-bridge.ts";

const source = await readFile(new URL("../app/character-playtest-bridge.ts", import.meta.url), "utf8");

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
    hand: ["h1"],
    deck: ["d1"],
    discard: [],
    destroyed: [],
    usedConsumableThisRound: false,
    wasHitSinceLastTurn: false,
    damageReductionUsed: false,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    ...overrides,
  };
}

const card = (overrides = {}) => ({ id: "card", name: "Card", cardType: "Attack", subtype: "Attack", zone: "High", tags: [], ...overrides });

test("Character host bridge delegates equipment restrictions to structured runtime", () => {
  assert.equal(characterHostCanEquip(board("DDB-CHR-CORE-021"), card({ cardType: "Item", subtype: "Weapon", tags: ["Weapon"] })), false);
  assert.equal(characterHostCanEquip(board("DDB-CHR-CORE-001"), card({ cardType: "Item", subtype: "Weapon", tags: ["Weapon"] })), true);
});

test("Character host bridge exposes structured attack zones, modifiers, pricing, and prevention", () => {
  const spin = card({ tags: ["Spin"] });
  assert.deepEqual(new Set(characterHostAttackZones(board("DDB-CHR-CORE-041"), spin, ["High"])), new Set(["High", "Mid", "Low"]));

  const modifier = characterHostAttackModifier(
    board("DDB-CHR-CORE-012", { usedConsumableThisRound: true }),
    board("DDB-CHR-CORE-001"),
    card(),
    { firstAttackThisTurn: true, usedConsumableThisTurn: true },
  );
  assert.equal(modifier.power, 1);

  assert.equal(characterHostPurchasePrice(board("DDB-CHR-CORE-006"), 7), 6);
  const reduced = characterHostDamageReduction(board("DDB-CHR-CORE-031"), 3);
  assert.equal(reduced.damage, 2);
});

test("Character host event preserves player choice while AI uses same runtime path", () => {
  const human = resolveCharacterHostEvent(
    board("DDB-CHR-CORE-003"),
    board("DDB-CHR-CORE-001"),
    { type: "incomingAttackDeclared", attackPower: 5 },
    "player",
  );
  assert.equal(human.choices.length, 1);
  assert.equal(human.event.attackPower, 5);

  const ai = resolveCharacterHostEvent(
    board("DDB-CHR-CORE-003"),
    board("DDB-CHR-CORE-001"),
    { type: "incomingAttackDeclared", attackPower: 5 },
    "ai",
  );
  assert.equal(ai.choices.length, 0);
  assert.equal(ai.event.attackPower, 4);
});

test("Character host lifecycle reset keeps game scope while clearing turn and round scope", () => {
  const initial = board("DDB-CHR-CORE-001", {
    usedCharacterEffectIdsThisTurn: ["turn"],
    usedCharacterEffectIdsThisRound: ["round"],
    usedCharacterEffectIdsThisGame: ["game"],
    characterMarks: { "turn:a": true, "round:b": true, "game:c": true },
  });
  const turn = resetCharacterHostTurn(initial);
  assert.deepEqual(turn.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(turn.usedCharacterEffectIdsThisRound, ["round"]);
  const round = resetCharacterHostRound(initial);
  assert.deepEqual(round.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(round.usedCharacterEffectIdsThisRound, []);
  assert.deepEqual(round.usedCharacterEffectIdsThisGame, ["game"]);
  assert.equal(round.characterMarks["game:c"], true);
});

test("Character bridge contains no card IDs, fighter names, or printed-rules parsing", () => {
  assert.doesNotMatch(source, /DDB-CHR-CORE-/);
  assert.doesNotMatch(source, /rulesText/);
  assert.doesNotMatch(source, /\.name\s*===/);
});
