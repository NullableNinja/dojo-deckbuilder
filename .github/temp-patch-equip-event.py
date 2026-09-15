from pathlib import Path

# Character event can carry pre-commit legality.
path = Path('app/character-runtime.ts')
text = path.read_text()
old = '''  targetId?: string | null;\n};'''
new = '''  targetId?: string | null;\n  allowed?: boolean;\n};'''
assert old in text
text = text.replace(old, new, 1)
old = '''      case "character.cannotEquipWeapons": if (event.card && !characterCanEquip(self, event.card)) { self = mark(self, "round:equipRejected", event.card.id); activated = true; } break;'''
new = '''      case "character.cannotEquipWeapons":\n        if (event.card && !characterCanEquip(self, event.card)) { event.allowed = false; activated = true; }\n        break;'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

# Migration ownership: equip is now event-runtime owned; only attackDeclared remains compatibility-owned.
path = Path('app/quick-duel-character-migration.ts')
text = path.read_text()
text = text.replace('''  | "characterAttackModifier"\n  | "characterCanEquip";''', '''  | "characterAttackModifier";''')
old = '''  characterCanEquip: [\n    "character.cannotEquipWeapons",\n  ],'''
assert old in text
text = text.replace(old, '', 1)
old = '''export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [\n  "attackDeclared",\n  "equip",\n] as const;'''
new = '''export const QUICK_DUEL_CHARACTER_COMPATIBILITY_EVENTS: readonly CharacterRuntimeEventType[] = [\n  "attackDeclared",\n] as const;'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

# Generic equip event host. Calling this for UI preview is side-effect free because returned boards are ignored.
path = Path('app/quick-duel-playtest-host.ts')
text = path.read_text()
anchor = '''export function publishQuickDuelPlaytestDamageIncoming<'''
insert = '''export type QuickDuelPlaytestEquipResult<Match> = QuickDuelPlaytestCharacterEventResult<Match> & {\n  allowed: boolean;\n};\n\nexport function publishQuickDuelPlaytestEquip<\n  Board extends QuickDuelComboMatchBoard & CharacterRuntimeBoard,\n  Match extends QuickDuelPlaytestHostMatch<Board>,\n>(\n  match: Match,\n  actor: QuickDuelPlaytestActor,\n  card: CharacterRuntimeEvent["card"],\n): QuickDuelPlaytestEquipResult<Match> {\n  let character = publishQuickDuelPlaytestCharacterEvent(match, actor, {\n    type: "equip",\n    card: card ?? null,\n    allowed: true,\n  });\n\n  if (actor === "ai") {\n    for (let guard = 0; guard < 8 && character.event && character.choices.length > 0; guard += 1) {\n      const choice = character.choices[0];\n      const selection = chooseAiCharacterOption(choice);\n      if (selection === null) break;\n      character = resolveQuickDuelPlaytestCharacterChoice(character.match, actor, character.event, choice, selection);\n    }\n  }\n\n  return { ...character, allowed: character.event?.allowed !== false };\n}\n\n'''
assert anchor in text and 'publishQuickDuelPlaytestEquip<' not in text
text = text.replace(anchor, insert + anchor, 1)
path.write_text(text)

# Playtest removes direct helper ownership and uses event host for preview/commit on both actors.
path = Path('app/playtest.tsx')
text = path.read_text()
old = 'import { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";'
new = 'import { characterAllowedAttackZones, characterAttackModifier, type CharacterRuntimeChoice, type CharacterRuntimeEvent } from "./character-runtime";'
assert old in text
text = text.replace(old, new, 1)
old = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestDamageIncoming, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
new = 'import { applyQuickDuelPlaytestTransition, hostQuickDuelPlaytestCardEvent, prepareQuickDuelPlaytestAttack, publishQuickDuelPlaytestDamageIncoming, publishQuickDuelPlaytestEquip, publishQuickDuelPlaytestLifecycleEvent, resolveQuickDuelPlaytestCharacterChoice } from "./quick-duel-playtest-host";'
assert old in text
text = text.replace(old, new, 1)

old = '''    if (!card || !isPermanent(card)) return current;\n    if (!characterCanEquip(current.player, card)) return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} cannot equip ${card.name}.`);\n    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, "player");'''
new = '''    if (!card || !isPermanent(card)) return current;\n    const characterEquip = publishQuickDuelPlaytestEquip(current, "player", card);\n    if (!characterEquip.allowed) return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} cannot equip ${card.name}.`);\n    let equippedMatch = characterEquip.match;\n    let nextPlayer = applyCardEffects({ ...equippedMatch.player, hand: removeOne(equippedMatch.player.hand, id), playArea: [...equippedMatch.player.playArea, id], cardsThisTurn: [...equippedMatch.player.cardsThisTurn, id] }, card, "player");'''
assert old in text
text = text.replace(old, new, 1)
old = '''        if (count) return write(current, `${card.name} equipped. ${source.name} requires ${count} discard${count === 1 ? "" : "s"}.`, { player: nextPlayer, pendingDiscard: { sourceCardId: source.id, remaining: count, sourceFollowup: false } });'''
new = '''        if (count) return write(equippedMatch, `${card.name} equipped. ${source.name} requires ${count} discard${count === 1 ? "" : "s"}.`, { player: nextPlayer, pendingDiscard: { sourceCardId: source.id, remaining: count, sourceFollowup: false } });'''
assert old in text
text = text.replace(old, new, 1)
old = '''    return write(current, `${card.name} equipped during Initiate. ${cardEffectNote(card)}`, { player: nextPlayer, pendingChoice });'''
new = '''    return write(equippedMatch, `${card.name} equipped during Initiate. ${cardEffectNote(card)}`, { player: nextPlayer, pendingChoice });'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const card = cardFor(id);\n    if (!card || isAttack(card) || isDefense(card) || card.subtype === "Junk" || !characterCanEquip(nextAi, card)) return false;\n    if (isCoreConsumableCard(card)) return canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(nextAi));'''
new = '''    const card = cardFor(id);\n    if (!card || isAttack(card) || isDefense(card) || card.subtype === "Junk") return false;\n    if (isPermanent(card) && !publishQuickDuelPlaytestEquip({ ...current, player: nextPlayer, ai: nextAi }, "ai", card).allowed) return false;\n    if (isCoreConsumableCard(card)) return canPlayCoreConsumableInPhase(card, "player-yell", stage3cConsumableContext(nextAi));'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);\n    if (isKata(card)) nextAi = stage3cConsumeKata(nextAi);\n    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, "ai", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(nextAi) : {});'''
new = '''    const locationModifier = locationFocusModifier(cardFor(current.locationId), card, nextAi);\n    if (isKata(card)) nextAi = stage3cConsumeKata(nextAi);\n    if (isPermanent(card)) {\n      const characterEquip = publishQuickDuelPlaytestEquip({ ...current, player: nextPlayer, ai: nextAi }, "ai", card);\n      if (!characterEquip.allowed) continue;\n      nextPlayer = characterEquip.match.player;\n      nextAi = characterEquip.match.ai;\n    }\n    nextAi = applyCardEffects({ ...nextAi, hand: removeOne(nextAi.hand, id), playArea: [...nextAi.playArea, id], cardsThisTurn: [...nextAi.cardsThisTurn, id], focus: nextAi.focus + locationModifier.value, lastAttackHit: false }, card, "ai", "onPlay", isCoreConsumableCard(card) ? stage3cConsumableContext(nextAi) : {});'''
assert old in text
text = text.replace(old, new, 1)

old = '''          const canInitiate = match.phase === "player-initiate" && permanent && characterCanEquip(player, card);'''
new = '''          const canInitiate = match.phase === "player-initiate" && permanent && publishQuickDuelPlaytestEquip(match, "player", card).allowed;'''
assert old in text
text = text.replace(old, new, 1)
assert 'characterCanEquip(' not in text
path.write_text(text)

# Migration tests: only attackDeclared remains compatibility-blocked.
path = Path('tests/quick-duel-character-migration.test.mjs')
text = path.read_text()
old = '''  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), true);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), true);'''
new = '''  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("attackDeclared"), true);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("damageIncoming"), false);\n  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), false);'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

path = Path('tests/quick-duel-character-executor.test.mjs')
text = path.read_text()
old = '''  for (const type of ["attackDeclared", "equip"]) {'''
new = '''  for (const type of ["attackDeclared"]) {'''
assert old in text
text = text.replace(old, new, 1)
old = '''  for (const type of ["cardPlayed", "damageIncoming", "hit", "block", "kataPlayed", "promotion", "hide"]) {'''
new = '''  for (const type of ["cardPlayed", "damageIncoming", "equip", "hit", "block", "kataPlayed", "promotion", "hide"]) {'''
assert old in text
text = text.replace(old, new, 1)
path.write_text(text)

Path('tests/quick-duel-character-equip-host.test.mjs').write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publishQuickDuelPlaytestEquip } from "../app/quick-duel-playtest-host.ts";
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
const weapon = { id:"wpn-1", name:"Test Weapon", cardType:"Item", subtype:"Weapon", tags:["Weapon"] };
const gear = { id:"gear-1", name:"Test Gear", cardType:"Item", subtype:"Gear", tags:["Equipment"] };

test("Knuckleton equip event rejects Weapons without fighter-specific Playtest dispatch", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-019" }), board());
  const rejected = publishQuickDuelPlaytestEquip(current, "player", weapon);
  assert.equal(rejected.published, true);
  assert.equal(rejected.conflict, false);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.event?.allowed, false);
  const allowed = publishQuickDuelPlaytestEquip(current, "player", gear);
  assert.equal(allowed.allowed, true);
});

test("Mr. Clip equip event primes next Defense and consumes its once-per-round Character use", () => {
  const current = match(board({ fighterId:"DDB-CHR-CORE-026" }), board());
  const hosted = publishQuickDuelPlaytestEquip(current, "player", gear);
  assert.equal(hosted.allowed, true);
  assert.equal(hosted.match.player.nextDefenseCardBonus, 1);
  assert.ok(hosted.match.player.usedCharacterEffectIdsThisRound?.includes("character-mr-clip-defense-guard"));
  assert.equal(hosted.match.player.characterMarks?.["round:clipEquip"], true);
});

test("AI uses the same equip event contract", () => {
  const current = match(board(), board({ fighterId:"DDB-CHR-CORE-019" }));
  const hosted = publishQuickDuelPlaytestEquip(current, "ai", weapon);
  assert.equal(hosted.allowed, false);
  assert.equal(hosted.choices.length, 0);
});

test("equip is no longer compatibility-blocked", () => {
  assert.equal(quickDuelCharacterEventHasCompatibilityConflict("equip"), false);
});

test("Quick Duel previews and commits Equip through the generic host and no longer calls characterCanEquip", () => {
  const source = fs.readFileSync(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /characterCanEquip\s*\(/);
  assert.match(source, /publishQuickDuelPlaytestEquip\(current, "player", card\)/);
  assert.match(source, /publishQuickDuelPlaytestEquip\(match, "player", card\)\.allowed/);
  assert.match(source, /publishQuickDuelPlaytestEquip\(\{ \.\.\.current, player: nextPlayer, ai: nextAi \}, "ai", card\)/);
  assert.doesNotMatch(source, /fighterId\s*===\s*["']DDB-CHR-CORE-/);
});
''')
