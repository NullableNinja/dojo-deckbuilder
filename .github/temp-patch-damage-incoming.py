from pathlib import Path

# 1) Migration ownership: damageIncoming moves fully to event runtime.
path = Path('app/quick-duel-character-migration.ts')
text = path.read_text()
text = text.replace('''  | "characterCanEquip"\n  | "characterDamageReduction";''', '''  | "characterCanEquip";''')
old = '''  characterCanEquip: [\n    "character.cannotEquipWeapons",\n  ],\n  characterDamageReduction: [\n    "character.damageThreshold",\n    "character.firstHitDamagePrevention",\n  ],'''
new = '''  characterCanEquip: [\n    "character.cannotEquipWeapons",\n  ],'''
assert old in text
text = text.replace(old, new, 1)
old = '''export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [\n  "attackDeclared",\n  "damageIncoming",\n  "equip",\n] as const;'''
new = '''export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [\n  "attackDeclared",\n  "equip",\n] as const;'''
assert old in text
text = text.replace(old, new, 1)
text = text.replace(''' * helpers still called directly by Quick Duel.''', ''' * helpers still called directly by Quick Duel.''')
path.write_text(text)

# 2) Generic Quick Duel host for Character damageIncoming.
path = Path('app/quick-duel-playtest-host.ts')
text = path.read_text()
anchor = '''export function publishQuickDuelPlaytestCharacterEvent<'''
insert = '''export function publishQuickDuelPlaytestDamageIncoming<\n  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,\n  Match extends QuickDuelPlaytestHostMatch<Board>,\n>(\n  match: Match,\n  defender: QuickDuelPlaytestActor,\n  damage: number,\n): QuickDuelPlaytestCharacterEventResult<Match> {\n  let character = publishQuickDuelPlaytestCharacterEvent(match, defender, {\n    type: "damageIncoming",\n    damage: Math.max(0, damage),\n  });\n\n  if (defender === "ai") {\n    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {\n      const choice = character.choices[0];\n      const selection = chooseAiCharacterOption(choice);\n      if (selection === null) break;\n      character = resolveQuickDuelPlaytestCharacterChoice(\n        character.match,\n        defender,\n        character.event,\n        choice,\n        selection,\n      );\n    }\n  }\n\n  return character;\n}\n\n'''
assert anchor in text and 'publishQuickDuelPlaytestDamageIncoming<' not in text
text = text.replace(anchor, insert + anchor, 1)
path.write_text(text)

# 3) Quick Duel removes the direct Character reduction helper and publishes at all live damage seams.
path = Path('app/playtest.tsx')
text = path.read_text()
old = 'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";'
new = 'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";'
assert old in text
text = text.replace(old, new, 1)
old = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
new = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestDamageIncoming, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
assert old in text
text = text.replace(old, new, 1)
old = '''function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {\n  const structuredReduction = stage3cTakeDamagePrevention(board, damage);\n  const equipmentReduction = applyMandatoryEquipmentDamageReduction(structuredReduction.board, structuredReduction.damage);\n  let next = equipmentReduction.board;\n  let remaining = equipmentReduction.damage;\n  const notes = [...structuredReduction.notes, ...equipmentReduction.notes];\n  if (remaining > 0) {\n    const before = remaining;\n    const characterReduction = characterDamageReduction(next, remaining);\n    next = { ...next, ...characterReduction.board, damageReductionUsed: next.damageReductionUsed || characterReduction.damage < before };\n    remaining = characterReduction.damage;\n    notes.push(...characterReduction.notes);\n  }\n  return { board: next, damage: remaining, note: notes.length ? notes.join("; ") : null };\n}'''
new = '''function reduceNonCharacterDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {\n  const structuredReduction = stage3cTakeDamagePrevention(board, damage);\n  const equipmentReduction = applyMandatoryEquipmentDamageReduction(structuredReduction.board, structuredReduction.damage);\n  return {\n    board: equipmentReduction.board,\n    damage: equipmentReduction.damage,\n    note: [...structuredReduction.notes, ...equipmentReduction.notes].join("; ") || null,\n  };\n}'''
assert old in text
text = text.replace(old, new, 1)

# Ordinary player Attack -> AI defender.
old = '''    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;\n    const reduced = reduceDamageForFighter(aiDefenseReaction.board, rawDamage);\n    const optionalReduced = applyOptionalCombatDamageReductionAi(reduced.board, reduced.damage);\n    const damage = optionalReduced.damage;'''
new = '''    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;\n    const reduced = reduceNonCharacterDamageForFighter(aiDefenseReaction.board, rawDamage);\n    const characterDamage = publishQuickDuelPlaytestDamageIncoming({ ...current, ai: reduced.board }, "ai", reduced.damage);\n    const characterDamageValue = characterDamage.event?.damage ?? reduced.damage;\n    const optionalReduced = applyOptionalCombatDamageReductionAi(characterDamage.match.ai, characterDamageValue);\n    const damage = optionalReduced.damage;'''
assert old in text
text = text.replace(old, new, 1)
old = '''...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : [])];'''
new = '''...optionalReduced.notes, ...aiPostBlock.notes, ...consumableAttackFollowup.notes, ...characterDamage.notes, ...(reduced.note ? [reduced.note] : [])];'''
assert old in text
text = text.replace(old, new, 1)

# AI Attack -> player defender. Preserve Character state before any optional Equipment prompt/recompute.
old = '''    const reduced = reduceDamageForFighter(nextPlayer, Math.max(0, rawDamage - defensePrevention));\n    const damageBeforeOptional = reduced.damage;'''
new = '''    const reduced = reduceNonCharacterDamageForFighter(nextPlayer, Math.max(0, rawDamage - defensePrevention));\n    const characterDamage = publishQuickDuelPlaytestDamageIncoming({ ...current, player: reduced.board }, "player", reduced.damage);\n    const damageBeforeOptional = characterDamage.event?.damage ?? reduced.damage;'''
assert old in text
text = text.replace(old, new, 1)
old = '''    let reducedBoard = reduced.board;\n    let damage = damageBeforeOptional;'''
new = '''    let reducedBoard = characterDamage.match.player;\n    let damage = damageBeforeOptional;'''
assert old in text
text = text.replace(old, new, 1)
old = '''...aiConsumableAttackFollowup.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];'''
new = '''...aiConsumableAttackFollowup.notes, ...characterDamage.notes, ...(reduced.note ? [reduced.note] : []), ...preventionNotes];'''
assert old in text
text = text.replace(old, new, 1)

# Player Reversal -> AI defender.
old = '''    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;\n    const reduced = reduceDamageForFighter(current.ai, rawDamage);\n    const optionalReduced = applyOptionalCombatDamageReductionAi(reduced.board, reduced.damage);\n    const damage = optionalReduced.damage;'''
new = '''    const rawDamage = hit ? Math.max(0, attackPower - defensePower + locationModifier.damage + fighterModifier.damage) : 0;\n    const reduced = reduceNonCharacterDamageForFighter(current.ai, rawDamage);\n    const characterDamage = publishQuickDuelPlaytestDamageIncoming({ ...current, ai: reduced.board }, "ai", reduced.damage);\n    const characterDamageValue = characterDamage.event?.damage ?? reduced.damage;\n    const optionalReduced = applyOptionalCombatDamageReductionAi(characterDamage.match.ai, characterDamageValue);\n    const damage = optionalReduced.damage;'''
assert old in text
text = text.replace(old, new, 1)
old = '''...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...(reduced.note ? [reduced.note] : [])];'''
new = '''...defenseFollowupNotes, ...optionalReduced.notes, ...aiPostBlock.notes, ...characterDamage.notes, ...(reduced.note ? [reduced.note] : [])];'''
assert old in text
text = text.replace(old, new, 1)

assert 'characterDamageReduction(' not in text
assert text.count('publishQuickDuelPlaytestDamageIncoming(') == 3
path.write_text(text)

# 4) Migration tests reflect the reduced compatibility surface.
path = Path('tests/quick-duel-character-migration.test.mjs')
text = path.read_text()
text = text.replace('compatibility ownership mirrors the four direct Character helpers still used by Playtest', 'compatibility ownership mirrors the direct Character helpers still used by Playtest')
old = '''  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), true);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), true);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), true);'''
new = '''  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), true);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), true);'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

# 5) End-to-end damageIncoming canaries and source ownership guard.
Path('tests/quick-duel-character-damage-incoming-host.test.mjs').write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publishQuickDuelPlaytestDamageIncoming } from "../app/quick-duel-playtest-host.ts";
import { quickDuelCharacterEventHasCompatibilityConflict } from "../app/quick-duel-character-migration.ts";

function board(overrides = {}) {
  return { fighterId:"DDB-CHR-CORE-001", belt:3, hp:10, maxHp:10, xp:0, focus:0, tempSpeed:0,
    nextAttackBonus:0, nextDefenseCardBonus:0, nextAttackHasFlow:false, nextAttackAnyZone:false,
    attacksThisTurn:0, zonesPlayed:[], cardsThisTurn:[], equipment:[], exhaustedEquipment:[],
    hand:[], deck:[], discard:[], destroyed:[], learnedCombos:[], triggeredCombos:[],
    usedConsumableThisRound:false, wasHitSinceLastTurn:false, damageReductionUsed:false,
    reversalAttackBonus:0, borrowedEquipmentId:null, abilityUsedRound:false,
    usedCharacterEffectIdsThisTurn:[], usedCharacterEffectIdsThisRound:[], usedCharacterEffectIdsThisGame:[],
    characterMarks:{}, stage3cStatuses:[], stage3cChoices:[], stage3cRestrictions:[], damageDealt:0, damageTaken:0,
    ...overrides };
}
function match(player=board(), ai=board()) { return { player, ai, lastExchange:null, locationId:"loc", round:1, turnIndex:0 }; }

test("Crash Test Dummy damageIncoming runs through event runtime and chains Green delayed Focus", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-007", belt:3 }));
  const hosted = publishQuickDuelPlaytestDamageIncoming(current, "ai", 4);
  assert.equal(hosted.published, true);
  assert.equal(hosted.conflict, false);
  assert.equal(hosted.event?.damage, 3);
  assert.equal(hosted.match.ai.nextInitiateFocus, 1);
  assert.ok(hosted.match.ai.usedCharacterEffectIdsThisRound?.includes("character-crash-impact-rated"));
});

test("Sentry Bobby player damageIncoming prevents first Hit and arms Green retaliation without a compatibility helper", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-031", belt:3 }), board());
  const hosted = publishQuickDuelPlaytestDamageIncoming(current, "player", 3);
  assert.equal(hosted.event?.damage, 2);
  assert.equal(hosted.match.player.nextAttackBonus, 1);
  assert.equal(hosted.choices.length, 0);
  assert.ok(hosted.match.player.usedCharacterEffectIdsThisRound?.includes("character-sentry-first-hit-prevent"));
});

test("damageIncoming is no longer compatibility-blocked", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);
});

test("all three live combat damage seams publish through the generic Character host and the direct reduction helper is gone", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/publishQuickDuelPlaytestDamageIncoming\(/g) ?? []).length, 3);
  assert.doesNotMatch(source, /characterDamageReduction\s*\(/);
  assert.match(source, /reduceNonCharacterDamageForFighter/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-/);
});
''')
