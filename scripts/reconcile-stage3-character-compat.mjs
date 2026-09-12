import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/playtest.tsx", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source fragment matched more than once`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceBetween(label, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker not found`);
  if (source.indexOf(startMarker, start + startMarker.length) >= 0) throw new Error(`${label}: start marker matched more than once`);
  source = source.slice(0, start) + replacement + "\n" + source.slice(end);
}

replaceOnce(
  "structured Character runtime imports",
  'import type { RuntimeChoice, RuntimeCommand, RuntimeStatus, RuntimeTrigger } from "./family-effect-runtime";',
  'import { structuredRuntimeResolvers, type RuntimeChoice, type RuntimeCommand, type RuntimeStatus, type RuntimeTrigger } from "./family-effect-runtime";\nimport { characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction } from "./character-runtime";',
);

replaceOnce(
  "Character runtime board state",
  '  abilityUsedRound: boolean;\n  reversalUsedRound: boolean;',
  '  abilityUsedRound: boolean;\n  usedCharacterEffectIdsThisTurn?: string[];\n  usedCharacterEffectIdsThisRound?: string[];\n  usedCharacterEffectIdsThisGame?: string[];\n  characterMarks?: Record<string, unknown>;\n  reversalUsedRound: boolean;',
);

replaceBetween(
  "structured Character attack zones",
  "function attackAllowedZones(board: Board, card: CardEntry) {",
  "function attackHasFlexibleZone(board: Board, card: CardEntry) {",
  `function attackAllowedZones(board: Board, card: CardEntry) {
  const conditional = finalAttackAllowedZones(card, { boughtCardLastAscend: board.boughtCardLastAscend });
  if (conditional.handled && conditional.zones.length > 1) return conditional.zones;
  if (board.nextAttackAnyZone || card.zone?.includes("Any")) return ["High", "Mid", "Low"];
  const equipped = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  if (attackCanChooseAnyZone(card, board.attacksThisTurn === 0, equipped)) return ["High", "Mid", "Low"];
  const printedZones = [card.zone?.split(",")[0] ?? "High"];
  return characterAllowedAttackZones(board, card, printedZones);
}`,
);

replaceBetween(
  "structured Character attack modifiers",
  "function fighterAttackModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {",
  "function reduceDamageForFighter(board: Board, damage: number): { board: Board; damage: number; note: string | null } {",
  `function fighterAttackModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {
  const fighter = cardFor(attacker.fighterId);
  if (!fighter) return { power: 0, damage: 0, notes: [] };
  const firstAttack = attacker.attacksThisTurn === 0;
  const hasWeaponEquipped = attacker.equipment.some((id) => { const item = cardFor(id); return item ? isWeapon(item) : false; });
  const printedZone = card.zone?.split(",")[0] ?? null;
  const previousZone = attacker.zonesPlayed.at(-1) ?? null;
  const structured = characterAttackModifier(attacker, defender, card, {
    firstAttackThisTurn: firstAttack,
    usedConsumableThisTurn: attacker.usedConsumableThisRound,
    hasWeaponEquipped,
    playedKataEarlierThisTurn: attacker.cardsThisTurn.some((id) => { const played = cardFor(id); return played ? isKata(played) : false; }),
    zone: printedZone ?? undefined,
    previousAttackZone: previousZone,
    differentZoneFromPreviousAttack: Boolean(previousZone && printedZone && previousZone !== printedZone),
  });
  const catchupEffect = structuredRuntimeResolvers(fighter, "character.xpTrailFirstHit")[0];
  const catchupDamage = firstAttack && defender.xp > attacker.xp ? Number(catchupEffect?.amount ?? 0) : 0;
  const notes = [...structured.notes];
  if (catchupDamage) notes.push(\`Character: XP-trail first Hit +\${catchupDamage} damage\`);
  return { power: structured.power, damage: structured.damage + catchupDamage, notes };
}`,
);

replaceOnce(
  "structured Character damage reduction",
  `  const fighter = cardFor(next.fighterId);
  if (fighter && !next.damageReductionUsed && remaining > 0) {
    const protects = fighter.name === "Sentry Bobby" || (fighter.name === "Crash Test Dummy" && remaining >= 4);
    if (protects) {
      next = { ...next, damageReductionUsed: true };
      remaining = Math.max(0, remaining - 1);
      notes.push(\`${'${fighter.name}'} reduces the Hit by 1\`);
    }
  }`,
  `  if (remaining > 0) {
    const before = remaining;
    const characterReduction = characterDamageReduction(next, remaining);
    next = { ...next, ...characterReduction.board, damageReductionUsed: next.damageReductionUsed || characterReduction.damage < before };
    remaining = characterReduction.damage;
    notes.push(...characterReduction.notes);
  }`,
);

replaceOnce(
  "player Equipment compatibility",
  '    if (cardFor(current.player.fighterId)?.name === "Knuckleton the Brawler" && isWeapon(card)) return write(current, "Knuckleton refuses the Weapon. The waiver cites \'personal reasons.\'");',
  '    if (!characterCanEquip(current.player, card)) return write(current, `${cardFor(current.player.fighterId)?.name ?? "Your fighter"} cannot equip ${card.name}.`);',
);

replaceOnce(
  "player Equipment affordance",
  '          const canInitiate = match.phase === "player-initiate" && permanent && !(playerFighter.name === "Knuckleton the Brawler" && isWeapon(card));',
  '          const canInitiate = match.phase === "player-initiate" && permanent && characterCanEquip(player, card);',
);

replaceOnce(
  "AI Equipment compatibility",
  '    if (!card || isAttack(card) || isDefense(card) || card.subtype === "Junk" || (fighter?.name === "Knuckleton the Brawler" && isWeapon(card))) return false;',
  '    if (!card || isAttack(card) || isDefense(card) || card.subtype === "Junk" || !characterCanEquip(nextAi, card)) return false;',
);

replaceOnce(
  "structured zone picker affordance",
  'match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && (pendingAttack.zone?.includes("Any") || (playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin")))',
  'match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && attackHasFlexibleZone(player, pendingAttack)',
);

const forbiddenRuntimeNames = [
  'fighter.name === "El Pollo Rojo"',
  'fighter.name === "Knuckleton the Brawler"',
  'fighter.name === "Wavey Davey"',
  'fighter.name === "Whirlwind Wynn"',
  'fighter.name === "Sentry Bobby"',
  'fighter.name === "Crash Test Dummy"',
];
for (const forbidden of forbiddenRuntimeNames) {
  if (source.includes(forbidden)) throw new Error(`Character runtime identity dispatch survived migration: ${forbidden}`);
}
for (const helper of ["characterAllowedAttackZones", "characterAttackModifier", "characterCanEquip", "characterDamageReduction"]) {
  const calls = source.match(new RegExp(`\\b${helper}\\s*\\(`, "g")) ?? [];
  if (!calls.length) throw new Error(`${helper} was not wired into Playtest`);
}

await writeFile(path, source);
console.log("Reconciled current-main Playtest Character compatibility through canonical structured helpers.");
