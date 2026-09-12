import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyCharacterEventForHost,
  beginCharacterHostRound,
  beginCharacterHostTurn,
  characterHostSubscriptions,
  requiredCharacterHostEvents,
} from "../app/character-playtest-bridge.ts";

const bridgeSource = await readFile(new URL("../app/character-playtest-bridge.ts", import.meta.url), "utf8");

function board(fighterId, overrides = {}) {
  return {
    fighterId,
    belt: 3,
    hp: 25,
    maxHp: 25,
    xp: 1,
    focus: 0,
    tempSpeed: 0,
    nextAttackBonus: 0,
    nextDefenseCardBonus: 0,
    nextAttackAnyZone: false,
    nextAttackHasFlow: false,
    attacksThisTurn: 0,
    zonesPlayed: [],
    cardsThisTurn: [],
    equipment: ["weapon"],
    exhaustedEquipment: [],
    hand: ["h1", "h2"],
    deck: ["d1", "d2", "d3"],
    discard: ["junk"],
    destroyed: [],
    usedConsumableThisRound: true,
    wasHitSinceLastTurn: true,
    damageReductionUsed: false,
    reversalAttackBonus: 0,
    nextInitiateFocus: 0,
    borrowedEquipmentId: null,
    abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [],
    usedCharacterEffectIdsThisRound: [],
    usedCharacterEffectIdsThisGame: [],
    characterMarks: {},
    hostOnlySentinel: "preserve-me",
    ...overrides,
  };
}

const attack = {
  id: "atk",
  name: "Synthetic host Attack",
  cardType: "Attack",
  subtype: "Attack",
  tags: ["Kick", "Spin", "Weapon", "Hand"],
  zone: "High",
};

function eventFor(type) {
  return {
    type,
    card: attack,
    zone: "Low",
    printedZone: "High",
    previousAttackZone: "Mid",
    attackPower: 5,
    damage: 5,
    opponentXp: 5,
    blocked: true,
    changedZone: true,
    wasReduced: true,
    usedConsumableThisTurn: true,
    playedKataEarlierThisTurn: true,
    differentZoneFromPreviousAttack: true,
    firstAttackThisTurn: true,
    firstKataThisTurn: true,
    secondKataThisTurn: true,
    thirdDifferentCardTypeThisTurn: true,
    completedBeltExam: true,
    sceneChanged: true,
    noCombatDamagePreviousTurn: true,
    opponentModifiedCard: true,
    discardedOutsideHide: true,
    discardedJunk: true,
    destroyedJunk: true,
    noPrintedNumericEffect: true,
    hasWeaponEquipped: false,
    revealIds: ["combo-a", "combo-b"],
    candidateIds: ["weapon", "h1"],
    replacementId: "replacement",
    selectedZone: "Low",
    selectedMode: "focus",
    optionalAccepted: true,
    modifierBonus: 3,
    targetId: "target",
  };
}

test("Character host subscriptions are derived for all 41 canonical Core Characters", () => {
  const subscriptions = characterHostSubscriptions();
  assert.equal(subscriptions.length, 41);
  assert.equal(new Set(subscriptions.map((entry) => entry.cardId)).size, 41);
  assert.ok(subscriptions.every((entry) => entry.cardId.startsWith("DDB-CHR-CORE-")));
  assert.ok(subscriptions.every((entry) => entry.events.length > 0));
});

test("every canonical Character event subscription crosses the host bridge without fighter-specific dispatch", () => {
  const foe = board("DDB-CHR-CORE-001", { xp: 3 });
  for (const subscription of characterHostSubscriptions()) {
    for (const type of subscription.events) {
      const self = board(subscription.cardId);
      const result = applyCharacterEventForHost(self, foe, eventFor(type), "ai");
      assert.equal(result.self.hostOnlySentinel, "preserve-me", `${subscription.cardId}/${type} must preserve unrelated Quick Duel state`);
      assert.equal(result.opponent.hostOnlySentinel, "preserve-me", `${subscription.cardId}/${type} opponent host state`);
      assert.equal(result.event.type, type, `${subscription.cardId}/${type} event publication`);
    }
  }
});

test("required host events include canonical subscriptions plus Character lifecycle cleanup", () => {
  const events = new Set(requiredCharacterHostEvents());
  for (const subscription of characterHostSubscriptions()) {
    for (const event of subscription.events) assert.ok(events.has(event), event);
  }
  assert.ok(events.has("turnStart"));
  assert.ok(events.has("roundStart"));
  assert.ok(events.has("hide"));
});

test("turn and round lifecycle bridges reset Character usage without dropping Quick Duel fields", () => {
  const self = board("DDB-CHR-CORE-001", {
    usedCharacterEffectIdsThisTurn: ["turn-effect"],
    usedCharacterEffectIdsThisRound: ["round-effect"],
    characterMarks: { "turn:test": true, "round:test": true, "game:test": true },
  });
  const foe = board("DDB-CHR-CORE-002");
  const turn = beginCharacterHostTurn(self, foe, "ai");
  assert.deepEqual(turn.self.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(turn.self.usedCharacterEffectIdsThisRound, ["round-effect"]);
  assert.equal(turn.self.hostOnlySentinel, "preserve-me");
  assert.equal(turn.self.characterMarks["turn:test"], undefined);
  assert.equal(turn.self.characterMarks["round:test"], true);

  const round = beginCharacterHostRound(self, foe, "ai");
  assert.deepEqual(round.self.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(round.self.usedCharacterEffectIdsThisRound, []);
  assert.equal(round.self.characterMarks["turn:test"], undefined);
  assert.equal(round.self.characterMarks["round:test"], undefined);
  assert.equal(round.self.characterMarks["game:test"], true);
  assert.equal(round.self.hostOnlySentinel, "preserve-me");
});

test("Hide is a required runtime event because borrowed Equipment returns through the Character runtime", () => {
  const self = board("DDB-CHR-CORE-001", { equipment: ["borrowed"], borrowedEquipmentId: "borrowed", discard: [] });
  const result = applyCharacterEventForHost(self, board("DDB-CHR-CORE-002"), { type: "hide" }, "ai");
  assert.equal(result.self.borrowedEquipmentId, null);
  assert.deepEqual(result.self.equipment, []);
  assert.deepEqual(result.self.discard, ["borrowed"]);
  assert.equal(result.self.hostOnlySentinel, "preserve-me");
});

test("Character host bridge contains no Character-name or printed-prose semantic dispatch", () => {
  assert.doesNotMatch(bridgeSource, /rulesText|compileCardEffects|effect-resolvers-legacy/);
  assert.doesNotMatch(bridgeSource, /DDB-CHR-CORE-\d{3}/);
  assert.match(bridgeSource, /applyCharacterRuntimeEvent/);
  assert.match(bridgeSource, /characterRuntimeCoverage/);
});
