from pathlib import Path

host = Path('app/quick-duel-playtest-host.ts')
text = host.read_text()
anchor = '''export function resolveQuickDuelPlaytestCharacterChoice<
'''
insert = '''export function publishQuickDuelPlaytestIncomingAttack<
  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,
  Match extends QuickDuelPlaytestHostMatch<Board>,
>(
  match: Match,
  defender: QuickDuelPlaytestActor,
  facts: { attackPower: number; modifierBonus?: number },
): QuickDuelPlaytestCharacterEventResult<Match> {
  let character = publishQuickDuelPlaytestCharacterEvent(match, defender, {
    type: "incomingAttackDeclared",
    attackPower: Math.max(0, Number(facts.attackPower)),
    modifierBonus: Math.max(0, Number(facts.modifierBonus ?? 0)),
  });

  if (defender === "ai") {
    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {
      const choice = character.choices[0];
      const selection = chooseAiCharacterOption(choice);
      if (selection === null) break;
      character = resolveQuickDuelPlaytestCharacterChoice(
        character.match,
        defender,
        character.event,
        choice,
        selection,
      );
    }
  }

  return character;
}

'''
assert anchor in text
text = text.replace(anchor, insert + anchor, 1)
host.write_text(text)

playtest = Path('app/playtest.tsx')
text = playtest.read_text()
old = '''import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'''
new = '''import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestIncomingAttack, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);
    const playerAirHorn = firstEventReactionCard(current.player.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
    const expectedIncomingDamage = Math.max(0, baseAttackPower - fighterStat(aiIncomingReaction.board, "DEF"));'''
new = '''    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cAttackBonus + tempoBonus + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power + armedEquipment.power - aiIncomingReaction.attackPowerPenalty);
    const modifierBonus = Math.max(0, baseAttackPower - Math.max(0, cardPower(card) + fighterStat(current.player, "ATK")));
    const incomingCharacter = publishQuickDuelPlaytestIncomingAttack(
      { ...current, ai: aiIncomingReaction.board },
      "ai",
      { attackPower: baseAttackPower, modifierBonus },
    );
    current = incomingCharacter.match;
    const characterAttackPower = Math.max(0, Number(incomingCharacter.event?.attackPower ?? baseAttackPower));
    const playerAirHorn = firstEventReactionCard(current.player.hand.map(cardFor).filter((candidate): candidate is CardEntry => Boolean(candidate && isCoreConsumableCard(candidate))), "cancel-reaction") as CardEntry | null;
    const expectedIncomingDamage = Math.max(0, characterAttackPower - fighterStat(current.ai, "DEF"));'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const aiConsumableReaction = current.airHornAiConsumableSpentThisStrike
      ? { board: aiIncomingReaction.board, card: null as CardEntry | null, notes: ["Air Horn canceled the computer's Consumable Reaction"] }
      : autoPlayAiDefensiveConsumable(aiIncomingReaction.board, expectedIncomingDamage);'''
new = '''    const aiConsumableReaction = current.airHornAiConsumableSpentThisStrike
      ? { board: current.ai, card: null as CardEntry | null, notes: ["Air Horn canceled the computer's Consumable Reaction"] }
      : autoPlayAiDefensiveConsumable(current.ai, expectedIncomingDamage);'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const defenseId = current.airHornAiDefenseSpentThisStrike
      ? null
      : bestDefense(aiConsumableReaction.board, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);'''
new = '''    const defenseId = current.airHornAiDefenseSpentThisStrike
      ? null
      : bestDefense(aiConsumableReaction.board, zone, Math.max(0, characterAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value, armorPenalty);'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));
    const attackPower = Math.max(0, baseAttackPower + postDefensePower.amount);
    const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiConsumableReaction.board) : { board: aiConsumableReaction.board, guard: 0, notes: [] as string[] };'''
new = '''    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));
    const attackPower = Math.max(0, characterAttackPower + postDefensePower.amount);
    const aiDefenseReaction = defenseCard ? autoActivateAiDefenseGuardEquipment(aiConsumableReaction.board) : { board: aiConsumableReaction.board, guard: 0, notes: [] as string[] };'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power);
    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);
    const defenseId = bestDefense(current.ai, zone, Math.max(0, baseAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));
    const attackPower = Math.max(0, baseAttackPower + postDefensePower.amount);'''
new = '''    const baseAttackPower = Math.max(0, cardPower(card) + fighterStat(current.player, "ATK") + current.player.nextAttackBonus + stage3cReversalBonus + (current.player.reversalAttackBonus ?? 0) + locationModifier.power + fighterModifier.power + printedModifier.power + incomingModifier.power);
    const modifierBonus = Math.max(0, baseAttackPower - Math.max(0, cardPower(card) + fighterStat(current.player, "ATK")));
    const incomingCharacter = publishQuickDuelPlaytestIncomingAttack(current, "ai", { attackPower: baseAttackPower, modifierBonus });
    current = incomingCharacter.match;
    const characterAttackPower = Math.max(0, Number(incomingCharacter.event?.attackPower ?? baseAttackPower));
    const defenseScenarioPower = afterDefenseAttackPowerBonus(card, true);
    const defenseId = bestDefense(current.ai, zone, Math.max(0, characterAttackPower + defenseScenarioPower.amount), settings.difficulty, location, card, current.player, piercingModifier.value);
    const defenseCard = defenseId ? cardFor(defenseId) : null;
    const postDefensePower = afterDefenseAttackPowerBonus(card, Boolean(defenseCard));
    const attackPower = Math.max(0, characterAttackPower + postDefensePower.amount);'''
assert old in text
text = text.replace(old, new, 1)
playtest.write_text(text)

Path('tests/quick-duel-character-incoming-attack-ai-host.test.mjs').write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { publishQuickDuelPlaytestIncomingAttack } from "../app/quick-duel-playtest-host.ts";

function board(overrides = {}) {
  return {
    fighterId: "DDB-CHR-CORE-001", belt: 3, hp: 10, maxHp: 10, xp: 0, focus: 0, tempSpeed: 0,
    nextAttackBonus: 0, nextDefenseCardBonus: 0, nextAttackHasFlow: false, nextAttackAnyZone: false,
    attacksThisTurn: 0, zonesPlayed: [], cardsThisTurn: [], equipment: [], exhaustedEquipment: [],
    hand: ["h1"], deck: ["d1"], discard: [], destroyed: [], learnedCombos: [], triggeredCombos: [],
    cardsBought: 0, usedConsumableThisRound: false, wasHitSinceLastTurn: false, damageReductionUsed: false,
    reversalAttackBonus: 0, borrowedEquipmentId: null, abilityUsedRound: false,
    usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [],
    characterMarks: {}, stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [],
    damageDealt: 0, damageTaken: 0, completedBeltExamThisRound: false, ...overrides,
  };
}

function match(ai) {
  return { player: board(), ai, market: [], round: 1, phase: "player-yell", turnOrder: ["player", "ai"], turnIndex: 0, lastExchange: null };
}

test("AI Blurred Monk automatically resolves incomingAttackDeclared through the generic Character choice contract", () => {
  const result = publishQuickDuelPlaytestIncomingAttack(match(board({ fighterId: "DDB-CHR-CORE-003" })), "ai", { attackPower: 7, modifierBonus: 3 });
  assert.equal(result.choices.length, 0);
  assert.equal(result.event?.attackPower, 6);
  assert.equal(result.match.ai.tempSpeed, -1);
  assert.equal(result.match.ai.characterMarks["round:reducedIncomingAttack"], true);
});

test("AI Gramma Uppercut removes only the structured modifier bonus", () => {
  const result = publishQuickDuelPlaytestIncomingAttack(match(board({ fighterId: "DDB-CHR-CORE-014" })), "ai", { attackPower: 8, modifierBonus: 3 });
  assert.equal(result.choices.length, 0);
  assert.equal(result.event?.attackPower, 5);
  assert.equal(result.event?.modifierBonus, 3);
});

test("AI Nerfhammer applies its passive incoming attack reduction", () => {
  const result = publishQuickDuelPlaytestIncomingAttack(match(board({ fighterId: "DDB-CHR-CORE-035" })), "ai", { attackPower: 7, modifierBonus: 2 });
  assert.equal(result.event?.attackPower, 6);
  assert.equal(result.match.ai.characterMarks["round:nerfhammerReduced"], true);
});

test("player defenders keep human Character choices unresolved", () => {
  const result = publishQuickDuelPlaytestIncomingAttack({ ...match(board()), player: board({ fighterId: "DDB-CHR-CORE-003" }) }, "player", { attackPower: 7, modifierBonus: 3 });
  assert.equal(result.choices.length, 1);
  assert.equal(result.event?.attackPower, 7);
});

test("Quick Duel publishes the AI defender event for both normal player strikes and reversals", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const calls = source.match(/publishQuickDuelPlaytestIncomingAttack\([^;]+?"ai"/gs) ?? [];
  assert.ok(calls.length >= 2, `expected at least two AI-defender incoming attack publications, found ${calls.length}`);
});
''')
