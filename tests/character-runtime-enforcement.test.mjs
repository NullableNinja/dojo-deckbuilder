import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCharacterRuntimeEvent,
  characterAllowedAttackZones,
  characterAttackModifier,
  characterCanEquip,
  characterDamageReduction,
  characterPurchasePrice,
  characterRuntimeCoverage,
  resetCharacterRound,
  resetCharacterTurn,
} from "../app/character-runtime.ts";

function board(fighterId, overrides = {}) {
  return {
    fighterId,
    belt: 3,
    hp: 25,
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
    deck: ["d1", "d2", "d3"],
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
    ...overrides,
  };
}

const foe = () => board("DDB-CHR-CORE-001", { xp: 3 });
const attack = (tags = [], zone = "High") => ({ id: "atk", cardType: "Attack", subtype: "Attack", tags, zone });
const kata = () => ({ id: "kata", cardType: "Kata", subtype: "Kata", tags: [], zone: null });
const weapon = () => ({ id: "weapon", cardType: "Item", subtype: "Weapon", tags: ["Weapon"], zone: null });

function run(id, event, self = {}, opponent = {}, actor = "ai") {
  return applyCharacterRuntimeEvent(board(id, self), board("DDB-CHR-CORE-001", opponent), event, actor);
}

test("Stage 3D runtime registry covers exactly the 41 Core Characters and every card has executable event wiring", () => {
  const coverage = characterRuntimeCoverage();
  assert.equal(coverage.length, 41);
  assert.equal(new Set(coverage.map((entry) => entry.cardId)).size, 41);
  assert.deepEqual(coverage.map((entry) => entry.cardId), Array.from({ length: 41 }, (_, index) => `DDB-CHR-CORE-${String(index + 1).padStart(3, "0")}`));
  for (const entry of coverage) {
    assert.ok(entry.resolvers.length > 0, `${entry.cardId} has a resolver`);
    assert.ok(entry.events.length > 0, `${entry.cardId} has a runtime event hook`);
  }
});

test("001 Auntie Parry: Block creates the canonical Reversal Attack Power bonus", () => {
  const result = run("DDB-CHR-CORE-001", { type: "block", blocked: true });
  assert.equal(result.self.reversalAttackBonus, 1);
});

test("002 Baron von Backflip: Speed change opens next Attack zone and Green changed Hit gains Focus", () => {
  const first = run("DDB-CHR-CORE-002", { type: "speedChanged" });
  assert.equal(first.self.nextAttackAnyZone, true);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit", changedZone: true }, "ai");
  assert.equal(second.self.focus, 1);
});

test("003 Blurred Monk: incoming choice reduces Attack and subsequent Block cycles", () => {
  const first = run("DDB-CHR-CORE-003", { type: "incomingAttackDeclared", attackPower: 4, optionalAccepted: true });
  assert.equal(first.event.attackPower, 3);
  assert.equal(first.self.tempSpeed, -1);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "block", blocked: true, selectedId: "h1" }, "ai");
  assert.equal(second.self.hand.length, 2);
  assert.ok(second.self.discard.includes("h1"));
});

test("004 Boo-Fu: discard outside Hide powers next Attack and Green recycles a discarded card after Hit", () => {
  const first = run("DDB-CHR-CORE-004", { type: "discarded", discardedOutsideHide: true });
  assert.equal(first.self.nextAttackBonus, 1);
  const prepared = { ...first.self, discard: ["trash"] };
  const second = applyCharacterRuntimeEvent(prepared, first.opponent, { type: "hit", selectedId: "trash" }, "ai");
  assert.equal(second.self.deck[0], "trash");
  assert.equal(second.self.discard.includes("trash"), false);
});

test("005 Coach Karen: opponent modification cycles and Green primes the matching card type", () => {
  const first = run("DDB-CHR-CORE-005", { type: "cardPlayed", opponentModifiedCard: true, card: attack(), selectedId: "h1" });
  assert.ok(first.self.discard.includes("h1"));
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "cardPlayed", card: attack() }, "ai");
  assert.equal(second.self.nextAttackBonus, 1);
});

test("006 Coupon Carl: eligible Market price is discounted with floor 4", () => {
  assert.equal(characterPurchasePrice(board("DDB-CHR-CORE-006"), 7), 6);
  assert.equal(characterPurchasePrice(board("DDB-CHR-CORE-006"), 5), 4);
  assert.equal(characterPurchasePrice(board("DDB-CHR-CORE-006"), 4), 4);
});

test("007 Crash Test Dummy: 4+ damage is reduced and Green queues Focus for next Initiate", () => {
  const result = run("DDB-CHR-CORE-007", { type: "damageIncoming", damage: 4 });
  assert.equal(result.event.damage, 3);
  assert.equal(result.self.nextInitiateFocus, 1);
});

test("008 Custodian Kwon: discarded Junk can be destroyed instead", () => {
  const result = run("DDB-CHR-CORE-008", { type: "discarded", discardedJunk: true, selectedId: "junk", optionalAccepted: true }, { discard: ["junk"] });
  assert.deepEqual(result.self.destroyed, ["junk"]);
  assert.equal(result.self.discard.includes("junk"), false);
});

test("009 Disco Dojo Dan: second zone grants Speed and Green primes Flow", () => {
  const result = run("DDB-CHR-CORE-009", { type: "cardPlayed", zone: "Mid" }, { zonesPlayed: ["High"] });
  assert.equal(result.self.tempSpeed, 1);
  assert.equal(result.self.nextAttackHasFlow, true);
});

test("010 Doodle Bopper: declaration zone change is recorded and Green adds Attack Power", () => {
  const result = run("DDB-CHR-CORE-010", { type: "attackDeclared", card: attack(), printedZone: "High", selectedZone: "Low", attackPower: 2 });
  assert.equal(result.event.changedZone, true);
  assert.equal(result.event.attackPower, 3);
});

test("011 El Pollo Rojo: first Hit while trailing XP deals one additional damage", () => {
  const result = run("DDB-CHR-CORE-011", { type: "hit", firstAttackThisTurn: true, damage: 2 }, { xp: 1 }, { xp: 5 });
  assert.equal(result.event.damage, 3);
});

test("012 Flaming Monk Dude Broski: Consumable setup powers first Attack and Green penalizes target next Attack", () => {
  const first = run("DDB-CHR-CORE-012", { type: "attackDeclared", firstAttackThisTurn: true, usedConsumableThisTurn: true, attackPower: 2 });
  assert.equal(first.event.attackPower, 3);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit" }, "ai");
  assert.equal(second.opponent.nextAttackBonus, -1);
});

test("013 Glitterpunch: first High Attack can become Mid and Green changed Hit cycles", () => {
  const allowed = characterAllowedAttackZones(board("DDB-CHR-CORE-013"), attack([], "High"), ["High"]);
  assert.ok(allowed.includes("Mid"));
  const first = run("DDB-CHR-CORE-013", { type: "attackDeclared", firstAttackThisTurn: true, printedZone: "High", selectedZone: "Mid", card: attack([], "High") });
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit", changedZone: true, selectedId: "h1" }, "ai");
  assert.ok(second.self.discard.includes("h1"));
});

test("014 Gramma Uppercut: once-game choice strips temporary Attack modifier bonus", () => {
  const result = run("DDB-CHR-CORE-014", { type: "incomingAttackDeclared", attackPower: 7, modifierBonus: 3, optionalAccepted: true });
  assert.equal(result.event.attackPower, 4);
  assert.equal(result.self.usedCharacterEffectIdsThisGame.length, 1);
});

test("015 Honorable Trash Panda: Junk destruction triggers Green draw/discard cycle", () => {
  const first = run("DDB-CHR-CORE-015", { type: "discarded", discardedJunk: true, selectedId: "junk", optionalAccepted: true }, { discard: ["junk"] });
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "discarded", destroyedJunk: true, selectedId: "h1" }, "ai");
  assert.ok(second.self.discard.includes("h1"));
});

test("016 Ink Fist: no-numeric card primes next Attack and Green linked Hit grants Focus", () => {
  const first = run("DDB-CHR-CORE-016", { type: "cardPlayed", noPrintedNumericEffect: true, card: kata() });
  assert.equal(first.self.nextAttackBonus, 1);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit" }, "ai");
  assert.equal(second.self.focus, 1);
});

test("017 Janitor Joe: Junk is recycled to deck bottom, cycles, and Green powers next Low Attack", () => {
  const first = run("DDB-CHR-CORE-017", { type: "discarded", discardedJunk: true, selectedId: "junk", selectedMode: "h1" }, { discard: ["junk"] });
  assert.equal(first.self.deck[0], "junk");
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "attackDeclared", zone: "Low", attackPower: 2 }, "ai");
  assert.equal(second.event.attackPower, 3);
});

test("018 Karatesaurus: first different-zone Kick gains Attack Power and Green Hit grants Speed", () => {
  const first = run("DDB-CHR-CORE-018", { type: "attackDeclared", card: attack(["Kick"]), firstAttackThisTurn: true, differentZoneFromPreviousAttack: true, attackPower: 2 });
  assert.equal(first.event.attackPower, 3);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit" }, "ai");
  assert.equal(second.self.tempSpeed, 1);
});

test("019 Knuckleton: Weapons cannot be equipped and first unarmed Attack modifies Attack Power, not damage", () => {
  assert.equal(characterCanEquip(board("DDB-CHR-CORE-019"), weapon()), false);
  const modifier = characterAttackModifier(board("DDB-CHR-CORE-019"), foe(), attack(), { firstAttackThisTurn: true, hasWeaponEquipped: false });
  assert.equal(modifier.power, 1);
  assert.equal(modifier.damage, 0);
});

test("020 Late Bell Lee: Speed change cycles one card", () => {
  const result = run("DDB-CHR-CORE-020", { type: "speedChanged", selectedId: "h1" });
  assert.ok(result.self.discard.includes("h1"));
});

test("021 Librarian Lin: two revealed Combos expose one legal deterministic selection", () => {
  const result = run("DDB-CHR-CORE-021", { type: "comboReveal", revealIds: ["combo-b", "combo-a"] });
  assert.equal(result.event.selectedId, "combo-b");
});

test("022 Margo Two-Forms: first Kata stores an additional next-Defense zone", () => {
  const result = run("DDB-CHR-CORE-022", { type: "kataPlayed", card: kata(), firstKataThisTurn: true, selectedZone: "Low" });
  assert.equal(result.self.characterMarks["turn:nextDefenseExtraZone"], "Low");
});

test("023 Master Bento Blitz: revealed Consumable at Initiate cycles", () => {
  const result = run("DDB-CHR-CORE-023", { type: "initiate", candidateIds: ["consumable"], selectedId: "consumable", selectedMode: "h1" });
  assert.ok(result.self.discard.includes("h1"));
});

test("024 Master Mimen: no-Weapon Initiate choice primes offense and Green linked Hit cycles", () => {
  const first = run("DDB-CHR-CORE-024", { type: "initiate", hasWeaponEquipped: false, selectedMode: "attack" });
  assert.equal(first.self.nextAttackBonus, 1);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit", selectedId: "h1" }, "ai");
  assert.ok(second.self.discard.includes("h1"));
});

test("025 Miss Direction: discard cost changes declared zone and Green changed Hit grants Focus", () => {
  const first = run("DDB-CHR-CORE-025", { type: "attackDeclared", printedZone: "High", selectedZone: "Low", selectedId: "h1", card: attack() });
  assert.ok(first.self.discard.includes("h1"));
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit", changedZone: true }, "ai");
  assert.equal(second.self.focus, 1);
});

test("026 Mr. Clip: permanent Equip primes next Defense Guard and linked Block cycles", () => {
  const first = run("DDB-CHR-CORE-026", { type: "equip", card: { id: "gear", cardType: "Item", subtype: "Gear", tags: [] } });
  assert.equal(first.self.nextDefenseCardBonus, 1);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "block", blocked: true, selectedId: "h1" }, "ai");
  assert.ok(second.self.discard.includes("h1"));
});

test("027 Paper Crane: first Kata grants Speed; second Kata at Green cycles and gains Focus", () => {
  const first = run("DDB-CHR-CORE-027", { type: "kataPlayed", firstKataThisTurn: true, card: kata() });
  assert.equal(first.self.tempSpeed, 1);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "kataPlayed", secondKataThisTurn: true, card: kata(), selectedId: "h1" }, "ai");
  assert.equal(second.self.focus, 1);
  assert.ok(second.self.discard.includes("h1"));
});

test("028 Punchline Pete: Kata setup powers first Attack and Green linked Hit reward can gain Focus", () => {
  const first = run("DDB-CHR-CORE-028", { type: "attackDeclared", firstAttackThisTurn: true, playedKataEarlierThisTurn: true, attackPower: 2, card: attack() });
  assert.equal(first.event.attackPower, 3);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hit", selectedMode: "focus" }, "ai");
  assert.equal(second.self.focus, 1);
});

test("029 Ronin Reroll: replacement reveal is once per game", () => {
  const first = run("DDB-CHR-CORE-029", { type: "sceneChange", replacementId: "scene-2", optionalAccepted: true });
  assert.equal(first.event.selectedId, "scene-2");
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "sceneChange", replacementId: "scene-3", optionalAccepted: true }, "ai");
  assert.equal(second.event.selectedId ?? null, null);
});

test("030 Sensei Ducktape: Initiate can equip permanent from discard and Hide returns it to discard", () => {
  const first = run("DDB-CHR-CORE-030", { type: "initiate", candidateIds: ["gear"], selectedId: "gear" }, { discard: ["gear"] });
  assert.ok(first.self.equipment.includes("gear"));
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "hide" }, "ai");
  assert.equal(second.self.equipment.includes("gear"), false);
  assert.ok(second.self.discard.includes("gear"));
});

test("031 Sentry Bobby: first Hit is reduced and Green primes retaliation", () => {
  const result = run("DDB-CHR-CORE-031", { type: "damageIncoming", damage: 3 });
  assert.equal(result.event.damage, 2);
  assert.equal(result.self.nextAttackBonus, 1);
});

test("032 Sir Kixalot: second Kick primes Flow for the next Kick", () => {
  const first = run("DDB-CHR-CORE-032", { type: "cardPlayed", card: attack(["Kick"]) });
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "cardPlayed", card: attack(["Kick"]) }, "ai");
  assert.equal(second.self.nextAttackHasFlow, true);
});

test("033 Some guy named Steve: no prior combat damage cycles at next Initiate", () => {
  const result = run("DDB-CHR-CORE-033", { type: "initiate", noCombatDamagePreviousTurn: true, selectedId: "h1" });
  assert.ok(result.self.discard.includes("h1"));
});

test("034 The Belt Collector: Belt Exam completion grants Speed and Green promotion draws two/discards one", () => {
  const first = run("DDB-CHR-CORE-034", { type: "cardPlayed", completedBeltExam: true });
  assert.equal(first.self.tempSpeed, 1);
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "promotion", selectedId: "h1" }, "ai");
  assert.equal(second.self.hand.length, 3);
});

test("035 The Nerfhammer: +2 modifier is reduced and Green primes retaliation", () => {
  const result = run("DDB-CHR-CORE-035", { type: "incomingAttackDeclared", attackPower: 6, modifierBonus: 2 });
  assert.equal(result.event.attackPower, 5);
  assert.equal(result.self.nextAttackBonus, 1);
});

test("036 The Rebooter: chosen Equipment receives same-turn printed-effect lock and Green cycles", () => {
  const result = run("DDB-CHR-CORE-036", { type: "reboot", candidateIds: ["gear"], selectedId: "gear", selectedMode: "h1" }, { equipment: ["gear"] });
  assert.equal(result.self.characterMarks["turn:rebootLocked:gear"], true);
  assert.ok(result.self.discard.includes("h1"));
});

test("037 Three Squirrels in One Gi: third different card type cycles", () => {
  const result = run("DDB-CHR-CORE-037", { type: "cardPlayed", thirdDifferentCardTypeThisTurn: true, selectedId: "h1", card: kata() });
  assert.ok(result.self.discard.includes("h1"));
});

test("038 Tia Three Gates: playing an Attack opens Any zone for the next Attack", () => {
  const result = run("DDB-CHR-CORE-038", { type: "cardPlayed", card: attack() });
  assert.equal(result.self.nextAttackAnyZone, true);
});

test("039 Venue Val: Scene Change cycles", () => {
  const result = run("DDB-CHR-CORE-039", { type: "sceneChange", sceneChanged: true, selectedId: "h1" });
  assert.ok(result.self.discard.includes("h1"));
});

test("040 Wavey Davey: being Hit since last turn adds Attack Power, not damage, to first Attack", () => {
  const result = run("DDB-CHR-CORE-040", { type: "attackDeclared", firstAttackThisTurn: true, attackPower: 2, card: attack() }, { wasHitSinceLastTurn: true });
  assert.equal(result.event.attackPower, 3);
  const modifier = characterAttackModifier(board("DDB-CHR-CORE-040", { wasHitSinceLastTurn: true }), foe(), attack(), { firstAttackThisTurn: true });
  assert.equal(modifier.damage, 0);
});

test("041 Whirlwind Wynn: first Spin Attack exposes all three legal zones", () => {
  const zones = characterAllowedAttackZones(board("DDB-CHR-CORE-041"), attack(["Spin"], "High"), ["High"]);
  assert.deepEqual(new Set(zones), new Set(["High", "Mid", "Low"]));
});

test("usage limits reset at the correct lifecycle boundaries without clearing once-per-game markers", () => {
  const gramma = run("DDB-CHR-CORE-014", { type: "incomingAttackDeclared", attackPower: 5, modifierBonus: 2, optionalAccepted: true }).self;
  const withScopes = { ...gramma, usedCharacterEffectIdsThisTurn: ["turn"], usedCharacterEffectIdsThisRound: ["round"] };
  const turn = resetCharacterTurn(withScopes);
  assert.deepEqual(turn.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(turn.usedCharacterEffectIdsThisRound, ["round"]);
  assert.equal(turn.usedCharacterEffectIdsThisGame.length, 1);
  const round = resetCharacterRound(withScopes);
  assert.deepEqual(round.usedCharacterEffectIdsThisTurn, []);
  assert.deepEqual(round.usedCharacterEffectIdsThisRound, []);
  assert.equal(round.usedCharacterEffectIdsThisGame.length, 1);
});

test("human choices remain explicit while AI resolves from the same legal option set", () => {
  const human = run("DDB-CHR-CORE-024", { type: "initiate", hasWeaponEquipped: false }, {}, {}, "player");
  assert.equal(human.choices.length, 1);
  assert.deepEqual(human.choices[0].options, ["attack", "defense"]);
  assert.equal(human.self.nextAttackBonus, 0);

  const ai = run("DDB-CHR-CORE-024", { type: "initiate", hasWeaponEquipped: false }, {}, {}, "ai");
  assert.equal(ai.choices.length, 0);
  assert.equal(ai.self.nextAttackBonus, 1);
});

test("Green abilities do not activate before Green Belt and activate immediately at Green", () => {
  const white = run("DDB-CHR-CORE-002", { type: "hit", changedZone: true }, { belt: 2 });
  assert.equal(white.self.focus, 0);
  const green = run("DDB-CHR-CORE-002", { type: "hit", changedZone: true }, { belt: 3 });
  assert.equal(green.self.focus, 1);
});

test("fixed Quick Duel HP is not mutated by Character promotion effects", () => {
  const result = run("DDB-CHR-CORE-034", { type: "promotion", selectedId: "h1" }, { hp: 17, maxHp: 25 });
  assert.equal(result.self.maxHp, 25);
  assert.equal(result.self.hp, 17);
});
