import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { applyCharacterRuntimeEvent } from "../app/character-runtime.ts";
import { queueOpponentCardModification, runtimeCommandCardModificationTypes } from "../app/character-card-modification-facts.ts";
import { applyQuickDuelPlaytestTransition, resolveQuickDuelPlaytestCharacterChoice } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-001", belt: 3, hp: 25, maxHp: 25, xp: 0, focus: 0, tempSpeed: 0, nextAttackBonus: 0, nextDefenseCardBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false, attacksThisTurn: 0, zonesPlayed: [], cardsThisTurn: [], equipment: [], exhaustedEquipment: [], hand: ["h1", "h2"], deck: ["d1", "d2"], discard: [], destroyed: [], learnedCombos: [], triggeredCombos: [], cardsBought: 0, usedConsumableThisRound: false, wasHitSinceLastTurn: false, damageReductionUsed: false, reversalAttackBonus: 0, borrowedEquipmentId: null, abilityUsedRound: false, usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [], characterMarks: {}, stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], damageDealt: 0, damageTaken: 0, completedBeltExamThisRound: false, ...overrides,
  };
}

function match(player = board(), ai = board()) {
  return { schema: 8, player, ai, market: [], round: 1, phase: "player-yell", turnOrder: ["player", "ai"], turnIndex: 0, lastExchange: null, pendingChoice: null, winner: null, log: [] };
}

const lookup = () => null;

test("Coach Karen White resolves from a semantic Attack modification and Green immediately arms +1 Attack Power", () => {
  const coach = board({ fighterId: "DDB-CHR-CORE-005", belt: 3 });
  const first = applyCharacterRuntimeEvent(coach, board(), { type: "cardModified", opponentModifiedCard: true, modifiedCardType: "Attack" }, "player");
  assert.equal(first.choices.length, 1);
  assert.ok(first.self.hand.includes("d2"), "White draws before asking what to discard");
  const resolved = applyCharacterRuntimeEvent(first.self, first.opponent, { ...first.event, selectedId: "h1" }, "player");
  assert.equal(resolved.choices.length, 0);
  assert.equal(resolved.self.nextAttackBonus, 1);
  assert.equal(resolved.self.discard.at(-1), "h1");
  assert.equal(resolved.self.characterMarks["round:modifiedCardType"], undefined);
});

test("Coach Karen Green arms +1 Guard for a Defense modification and AI uses the same runtime contract", () => {
  const coach = board({ fighterId: "DDB-CHR-CORE-005", belt: 3 });
  const resolved = applyCharacterRuntimeEvent(coach, board(), { type: "cardModified", opponentModifiedCard: true, modifiedCardType: "Defense" }, "ai");
  assert.equal(resolved.choices.length, 0);
  assert.equal(resolved.self.nextDefenseCardBonus, 1);
  assert.equal(resolved.self.hand.length, 2, "AI draws one and discards one through White");
});

test("Coach Karen White/Green remain once per round", () => {
  const coach = board({ fighterId: "DDB-CHR-CORE-005", belt: 3 });
  const first = applyCharacterRuntimeEvent(coach, board(), { type: "cardModified", modifiedCardType: "Attack" }, "ai");
  const second = applyCharacterRuntimeEvent(first.self, first.opponent, { type: "cardModified", modifiedCardType: "Defense" }, "ai");
  assert.equal(second.self.nextAttackBonus, 1);
  assert.equal(second.self.nextDefenseCardBonus, 0);
  assert.deepEqual(second.self.hand, first.self.hand);
});

test("queued opponent modification facts publish through Quick Duel and surface the human White choice", () => {
  const previous = match(board({ fighterId: "DDB-CHR-CORE-005", belt: 3 }));
  const next = { ...previous, player: queueOpponentCardModification(previous.player, "Attack") };
  const hosted = applyQuickDuelPlaytestTransition(previous, next, lookup);
  assert.equal(hosted.pendingChoice?.kind, "character-runtime");
  assert.equal(hosted.pendingChoice?.event?.type, "cardModified");
  assert.equal(hosted.pendingChoice?.event?.modifiedCardType, "Attack");
  const resumed = resolveQuickDuelPlaytestCharacterChoice(hosted, "player", hosted.pendingChoice.event, hosted.pendingChoice.choice, "h1");
  assert.equal(resumed.match.player.nextAttackBonus, 1);
});

test("runtime-command provenance recognizes only opponent-targeted next Attack/Defense card modifiers", () => {
  assert.deepEqual(runtimeCommandCardModificationTypes([
    { effect: "combat.modifyAttackPower", target: "opponent", duration: "nextAttack" },
    { effect: "combat.modifyGuard", target: "opponent", duration: "nextDefense" },
    { effect: "combat.modifySpeed", target: "opponent", duration: "endOfRound" },
    { effect: "combat.modifyAttackPower", target: "self", duration: "nextAttack" },
  ]), ["Attack", "Defense"]);
});

test("Coach integration stays generic and canonical", async () => {
  const [runtime, playtest, routes, canonical] = await Promise.all([
    readFile(new URL("../app/character-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quick-duel-character-event-routes.ts", import.meta.url), "utf8"),
    readFile(new URL("../content/card-effects/characters.json", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /character\.opponentModificationCycle": \["cardModified"\]/);
  assert.match(runtime, /character\.green\.repeatModifiedCardTypeBonus": \["cardModified"\]/);
  assert.match(routes, /event: "cardModified"/);
  assert.doesNotMatch(playtest, /Coach Karen|DDB-CHR-CORE-005/);
  const registry = JSON.parse(canonical);
  const green = registry.cards["DDB-CHR-CORE-005"].effects.find((effect) => effect.resolver === "character.green.repeatModifiedCardTypeBonus");
  assert.equal(green.amount, 1);
});
