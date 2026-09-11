import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceRequired(search, replacement, label = search) {
  if (!source.includes(search)) throw new Error(`Missing expected source for ${label}`);
  source = source.replace(search, replacement);
  console.log(`${label}: replaced`);
}

function replaceAllRequired(search, replacement, label = search) {
  const count = source.split(search).length - 1;
  if (!count) throw new Error(`Missing expected source for ${label}`);
  source = source.split(search).join(replacement);
  console.log(`${label}: ${count} replacement(s)`);
}

function replaceBetween(start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`Missing start marker for ${label}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`Missing end marker for ${label}`);
  source = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
  console.log(`${label}: replaced block`);
}

const familyRuntimeImport = 'import { structuredRuntimeResolvers, type RuntimeChoice, type RuntimeCommand, type RuntimeStatus, type RuntimeTrigger } from "./family-effect-runtime";';
replaceRequired(
  familyRuntimeImport,
  `${familyRuntimeImport}\nimport { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction } from "./character-runtime";\nimport { structuredLocationDefenseForHost, structuredLocationKataForHost } from "./location-playtest-bridge";`,
  "structured Character/Location host imports",
);

replaceRequired(
  '  abilityUsedRound: boolean;\n  reversalUsedRound: boolean;',
  '  abilityUsedRound: boolean;\n  usedCharacterEffectIdsThisTurn?: string[];\n  usedCharacterEffectIdsThisRound?: string[];\n  usedCharacterEffectIdsThisGame?: string[];\n  characterMarks?: Record<string, unknown>;\n  reversalUsedRound: boolean;',
  "Character runtime state on Board",
);

replaceRequired(
  '    reversalUsedRound: false, learnedCombos: [], triggeredCombos: [], comboAttemptedTurn: false,',
  '    reversalUsedRound: false, usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [], characterMarks: {}, learnedCombos: [], triggeredCombos: [], comboAttemptedTurn: false,',
  "initial Character runtime state",
);

replaceBetween(
  'function locationAttackModifier(location: CardEntry | undefined, card: CardEntry, board: Board, zone: string): AttackModifier {',
  'function locationDefenseModifier(location: CardEntry | undefined, card: CardEntry | null | undefined, board: Board, zone: string): CombatModifier {',
  `function locationAttackModifier(location: CardEntry | undefined, card: CardEntry, board: Board, zone: string): AttackModifier {\n  if (!location) return { power: 0, damage: 0, notes: [] };\n  const firstAttack = board.attacksThisTurn === 0;\n  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));\n  const parsed = locationAttackRuleModifiers(location, {\n    zone,\n    firstAttack,\n    attackTags: card.tags,\n    hasWeapon: equipped.some(isWeapon),\n    equipmentTags: equipped.flatMap((item) => item.tags),\n  });\n  return { power: parsed.power, damage: parsed.damage, notes: parsed.notes };\n}\n\n`,
  "Location attack host boundary",
);

replaceBetween(
  'function locationDefenseModifier(location: CardEntry | undefined, card: CardEntry | null | undefined, board: Board, zone: string): CombatModifier {',
  'function locationFocusModifier(location: CardEntry | undefined, card: CardEntry, board: Board): CombatModifier {',
  `function locationDefenseModifier(location: CardEntry | undefined, card: CardEntry | null | undefined, board: Board, zone: string): CombatModifier {\n  if (!location || !card) return { value: 0, notes: [] };\n  const parsed = structuredLocationDefenseForHost(location, {\n    zone,\n    defenseTags: card.tags,\n    firstDefenseThisRound: !board.defendedThisRound,\n  });\n  return { value: parsed.guard, notes: parsed.notes };\n}\n\n`,
  "Location defense host boundary",
);

replaceBetween(
  'function locationFocusModifier(location: CardEntry | undefined, card: CardEntry, board: Board): CombatModifier {',
  'function printedAttackRuleModifier(',
  `function locationFocusModifier(location: CardEntry | undefined, card: CardEntry, board: Board): CombatModifier {\n  const kataAlreadyPlayed = board.cardsThisTurn.some((id) => { const played = cardFor(id); return played ? isKata(played) : false; });\n  if (!location || !isKata(card) || kataAlreadyPlayed) return { value: 0, notes: [] };\n  const parsed = structuredLocationKataForHost(location, { firstKataThisTurn: true });\n  const value = parsed.setFocusTo === null ? parsed.focus : parsed.setFocusTo - cardFocus(card);\n  return { value, notes: parsed.notes };\n}\n\n`,
  "Location Kata Focus host boundary",
);

replaceBetween(
  'function attackAllowedZones(board: Board, card: CardEntry) {',
  'function attackHasFlexibleZone(board: Board, card: CardEntry) {',
  `function attackAllowedZones(board: Board, card: CardEntry) {\n  const allZones = ["High", "Mid", "Low"];\n  const conditional = finalAttackAllowedZones(card, { boughtCardLastAscend: board.boughtCardLastAscend });\n  if (conditional.handled && conditional.zones.length > 1) return conditional.zones;\n  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return allZones;\n  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));\n  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return allZones;\n  const printedZones = [card.zone?.split(",")[0] ?? "High"];\n  return characterAllowedAttackZones(board, card, printedZones);\n}\n`,
  "Character attack-zone host boundary",
);

replaceBetween(
  'function fighterAttackModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {',
  'function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {',
  `function fighterAttackModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {\n  const fighter = cardFor(attacker.fighterId);\n  if (!fighter) return { power: 0, damage: 0, notes: [] };\n  const firstAttack = attacker.attacksThisTurn === 0;\n  const hasWeaponEquipped = attacker.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; });\n  const printedZone = card.zone?.split(",")[0] ?? null;\n  const previousZone = attacker.zonesPlayed.at(-1) ?? null;\n  const structured = characterAttackModifier(attacker, defender, card, {\n    firstAttackThisTurn: firstAttack,\n    usedConsumableThisTurn: attacker.usedConsumableThisRound,\n    hasWeaponEquipped,\n    playedKataEarlierThisTurn: attacker.cardsThisTurn.some((id) => { const played = cardFor(id); return played ? isKata(played) : false; }),\n    zone: printedZone ?? undefined,\n    previousAttackZone: previousZone,\n    differentZoneFromPreviousAttack: Boolean(previousZone && printedZone && previousZone !== printedZone),\n  });\n  const catchupEffect = structuredRuntimeResolvers(fighter, "character.xpTrailFirstHit")[0];\n  const catchupDamage = firstAttack && defender.xp > attacker.xp ? Number(catchupEffect?.amount ?? 0) : 0;\n  const notes = [...structured.notes];\n  if (catchupDamage) notes.push(\`Character: XP-trail first Hit +\${catchupDamage} damage\`);\n  return { power: structured.power, damage: structured.damage + catchupDamage, notes };\n}\n\n`,
  "Character attack modifier host boundary",
);

replaceBetween(
  'function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {',
  'function drawCards(board: Board, count: number) {',
  `function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {\n  const structuredReduction = stage3cTakeDamagePrevention(board, damage);\n  const equipmentReduction = applyMandatoryEquipmentDamageReduction(structuredReduction.board, structuredReduction.damage);\n  let next = equipmentReduction.board;\n  let remaining = equipmentReduction.damage;\n  const notes = [...structuredReduction.notes, ...equipmentReduction.notes];\n  if (remaining > 0) {\n    const before = remaining;\n    const characterReduction = characterDamageReduction(next, remaining);\n    next = { ...next, ...characterReduction.board, damageReductionUsed: next.damageReductionUsed || characterReduction.damage < before };\n    remaining = characterReduction.damage;\n    notes.push(...characterReduction.notes);\n  }\n  return { board: next, damage: remaining, note: notes.length ? notes.join("; ") : null };\n}\n\n`,
  "Character damage-reduction host boundary",
);

replaceRequired(
  '    if (cardFor(current.player.fighterId)?.name === "Knuckleton the Brawler" && isWeapon(card)) return write(current, "Knuckleton refuses the Weapon. The waiver cites \'personal reasons.\'");',
  '    if (!characterCanEquip(current.player, card)) return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} cannot equip ${card.name}.`);',
  "Character equipment restriction",
);

replaceRequired(
  '    if (!current || current.phase !== "player-initiate" || current.player.abilityUsedRound || cardFor(current.player.fighterId)?.name !== "Sensei Ducktape") return current;',
  '    if (!current || current.phase !== "player-initiate" || current.player.abilityUsedRound || !cardHasRuntimeResolver(cardFor(current.player.fighterId), "character.equipDiscardPermanentUntilHide")) return current;',
  "Character discard-equipment ability guard",
);

replaceRequired(
  '    return write(current, `Sensei Ducktape jury-rigs ${card.name} from the discard pile until Hide.`, { player: nextPlayer });',
  '    return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} jury-rigs ${card.name} from the discard pile until Hide.`, { player: nextPlayer });',
  "Character discard-equipment ability log",
);

replaceRequired(
  '          const canInitiate = match.phase === "player-initiate" && permanent && !(playerFighter.name === "Knuckleton the Brawler" && isWeapon(card));',
  '          const canInitiate = match.phase === "player-initiate" && permanent && characterCanEquip(player, card);',
  "Character equipment UI legality",
);

replaceRequired(
  '{match.phase === "player-initiate" && playerFighter.name === "Sensei Ducktape" && !player.abilityUsedRound && player.discard.some((id) => { const card = cardFor(id); return card ? isPermanent(card) : false; }) && <div className="ducktape-tray"><span>Sensei Ducktape · emergency repair</span>',
  '{match.phase === "player-initiate" && cardHasRuntimeResolver(playerFighter, "character.equipDiscardPermanentUntilHide") && !player.abilityUsedRound && player.discard.some((id) => { const card = cardFor(id); return card ? isPermanent(card) : false; }) && <div className="ducktape-tray"><span>{playerFighter.name} · emergency repair</span>',
  "Character discard-equipment UI",
);

replaceRequired(
  '{match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && (pendingAttack.zone?.includes("Any") || (playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin"))) && <div className="hand-context-strip">',
  '{match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && attackHasFlexibleZone(player, pendingAttack) && <div className="hand-context-strip">',
  "Character flexible-zone UI",
);

replaceAllRequired(
  'damageReductionUsed: false, blockedThisRound: false, usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0,',
  'damageReductionUsed: false, blockedThisRound: false, usedEffectIdsThisTurn: [], usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], characterMarks: {}, nextAttackArmorPenalty: 0,',
  "round Character runtime reset",
);
replaceRequired(
  'usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false,',
  'usedEffectIdsThisTurn: [], usedCharacterEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, comboAttemptedTurn: false,',
  "turn Character runtime reset",
);

const bannedIdentityTokens = [
  'location.name === "River Dock"',
  'location.name === "Yoga Studio"',
  'location.name === "City Bus in Motion"',
  'location.name === "Community Ice Rink"',
  'location.name === "School Gymnasium"',
  'location.name === "Strip-Mall McDojo"',
  'location.name === "Traditional Dojo"',
  'fighter.name === "El Pollo Rojo"',
  'fighter.name === "Knuckleton the Brawler"',
  'fighter.name === "Wavey Davey"',
  'fighter.name === "Whirlwind Wynn"',
  'fighter.name === "Sentry Bobby"',
  'fighter.name === "Crash Test Dummy"',
  'playerFighter.name === "Knuckleton the Brawler"',
  'playerFighter.name === "Sensei Ducktape"',
  'playerFighter.name === "Whirlwind Wynn"',
  'cardFor(current.player.fighterId)?.name !== "Sensei Ducktape"',
];
for (const token of bannedIdentityTokens) {
  if (source.includes(token)) throw new Error(`Host-boundary remediation left identity dispatch: ${token}`);
}

fs.writeFileSync(path, source);
console.log("Stage 3 final Character/Location host-boundary remediation written.");
