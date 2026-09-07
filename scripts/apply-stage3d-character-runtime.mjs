import fs from "node:fs";

function replaceOnce(text, search, replacement, label) {
  if (text.includes(replacement)) return text;
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`Stage 3D patch anchor missing: ${label}`);
  if (text.indexOf(search, index + search.length) >= 0) throw new Error(`Stage 3D patch anchor is not unique: ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

function replaceRegexOnce(text, regex, replacement, label) {
  const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`))];
  if (!matches.length) {
    if (typeof replacement === "string" && text.includes(replacement)) return text;
    throw new Error(`Stage 3D patch regex anchor missing: ${label}`);
  }
  if (matches.length !== 1) throw new Error(`Stage 3D patch regex anchor is not unique (${matches.length}): ${label}`);
  return text.replace(regex, replacement);
}

const runtimePath = "app/character-runtime.ts";
let runtime = fs.readFileSync(runtimePath, "utf8");
runtime = runtime.replace('from "./character-effect-resolvers";', 'from "./character-effect-resolvers.ts";');
fs.writeFileSync(runtimePath, runtime);

const playtestPath = "app/playtest.tsx";
let source = fs.readFileSync(playtestPath, "utf8");

source = replaceOnce(
  source,
  'import type { RuntimeChoice, RuntimeCommand, RuntimeStatus, RuntimeTrigger } from "./family-effect-runtime";\n',
  'import type { RuntimeChoice, RuntimeCommand, RuntimeStatus, RuntimeTrigger } from "./family-effect-runtime";\nimport { applyCharacterRuntimeEvent, characterAllowedAttackZones, characterAttackModifier, characterCanEquip, characterDamageReduction, characterPurchasePrice, resetCharacterRound, resetCharacterTurn } from "./character-runtime";\n',
  "Character runtime import",
);

source = replaceOnce(
  source,
  '  stage3cPurchaseCostModifier?: number;\n};',
  '  stage3cPurchaseCostModifier?: number;\n  usedCharacterEffectIdsThisTurn?: string[];\n  usedCharacterEffectIdsThisRound?: string[];\n  usedCharacterEffectIdsThisGame?: string[];\n  characterMarks?: Record<string, unknown>;\n};',
  "Board Character runtime state",
);

source = replaceOnce(
  source,
  '    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cPurchaseCostModifier: 0,\n',
  '    damageDealt: 0, damageTaken: 0, cardsBought: 0, destroyed: [], returnedToSupply: [], stage3cStatuses: [], stage3cChoices: [], stage3cRestrictions: [], stage3cDefenseModifier: 0, stage3cPurchaseCostModifier: 0,\n    usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], usedCharacterEffectIdsThisGame: [], characterMarks: {},\n',
  "initial Character runtime state",
);

source = replaceOnce(
  source,
  '  return Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);',
  '  const normalPrice = Math.max(0, cardCost(card) + (board.stage3cPurchaseCostModifier ?? 0) + (card.cardType === "Item" ? (board.nextItemCostPenalty ?? 0) : 0) - certificationDiscount);\n  return characterPurchasePrice(board, normalPrice);',
  "Coupon Carl Market price",
);

source = replaceOnce(
  source,
  'function attackAllowedZones(board: Board, card: CardEntry) {\n',
  'function attackAllowedZones(board: Board, card: CardEntry) {\n  const printedZones = card.zone?.includes("Any") ? ["High", "Mid", "Low"] : [card.zone?.split(",")[0] ?? "High"];\n  const characterZones = characterAllowedAttackZones(board, card, printedZones);\n  if (characterZones.length > printedZones.length) return characterZones;\n',
  "Character attack zone hook",
);

source = replaceRegexOnce(
  source,
  /function fighterAttackModifier\(attacker: Board, defender: Board, card: CardEntry\): AttackModifier \{[\s\S]*?\n\}\n\nfunction reduceDamageForFighter/,
  `function fighterAttackModifier(attacker: Board, defender: Board, card: CardEntry): AttackModifier {
  const firstAttack = attacker.attacksThisTurn === 0;
  const previousZone = attacker.zonesPlayed.at(-1) ?? null;
  const printedZone = card.zone?.split(",")[0] ?? null;
  const hasWeaponEquipped = attacker.equipment.some((id) => { const item = cardFor(id); return Boolean(item && isWeapon(item)); });
  const playedKataEarlierThisTurn = attacker.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); });
  return characterAttackModifier(attacker, defender, card, {
    firstAttackThisTurn: firstAttack,
    usedConsumableThisTurn: Boolean(attacker.usedConsumableThisRound),
    playedKataEarlierThisTurn,
    differentZoneFromPreviousAttack: Boolean(previousZone && printedZone && previousZone !== printedZone),
    hasWeaponEquipped,
  });
}

function reduceDamageForFighter`,
  "replace legacy fighter-name attack modifier",
);

source = replaceRegexOnce(
  source,
  /  const fighter = cardFor\(next\.fighterId\);\n  if \(fighter && !next\.damageReductionUsed && remaining > 0\) \{[\s\S]*?\n  \}\n  return \{ board: next, damage: remaining, note: notes\.length \? notes\.join\("; "\) : null \};/,
  `  const characterReduction = characterDamageReduction(next, remaining);
  next = characterReduction.board;
  remaining = characterReduction.damage;
  notes.push(...characterReduction.notes);
  return { board: next, damage: remaining, note: notes.length ? notes.join("; ") : null };`,
  "replace legacy fighter-name damage reduction",
);

source = replaceOnce(
  source,
  '    if (cardFor(current.player.fighterId)?.name === "Knuckleton the Brawler" && isWeapon(card)) return write(current, "Knuckleton refuses the Weapon. The waiver cites \'personal reasons.\'");',
  '    if (!characterCanEquip(current.player, card)) return write(current, `${cardFor(current.player.fighterId)?.name ?? "This fighter"} cannot Equip ${card.name}.`);',
  "Knuckleton structured equip restriction",
);

source = source.replace(
  'const canInitiate = match.phase === "player-initiate" && permanent && !(playerFighter.name === "Knuckleton the Brawler" && isWeapon(card));',
  'const canInitiate = match.phase === "player-initiate" && permanent && characterCanEquip(player, card);',
);

source = source.replace(
  '(pendingAttack.zone?.includes("Any") || (playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin")))',
  '(attackAllowedZones(player, pendingAttack).length > 1)',
);

source = replaceOnce(
  source,
  '    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, "player");',
  '    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, "player");\n    const characterEquip = applyCharacterRuntimeEvent(nextPlayer, current.ai, { type: "equip", card }, "player");\n    nextPlayer = characterEquip.self as Board;',
  "Character Equipment event",
);

source = replaceOnce(
  source,
  '  const readyBoard = stage3cEndTurn(applyHideReady(hideBoard));',
  '  const characterHide = applyCharacterRuntimeEvent(hideBoard, hideBoard, { type: "hide" }, "ai");\n  const readyBoard = stage3cEndTurn(applyHideReady(resetCharacterTurn(characterHide.self as Board)));',
  "Character Hide/turn reset",
);

source = source.replace(
  'usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] });',
  'usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [], usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], characterMarks: Object.fromEntries(Object.entries(current.player.characterMarks ?? {}).filter(([key]) => !key.startsWith("turn:") && !key.startsWith("round:"))) });',
);
source = source.replace(
  'usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [] });\n  const marketState',
  'usedEffectIdsThisTurn: [], nextAttackArmorPenalty: 0, abilityUsedRound: false, reversalUsedRound: false, triggeredCombos: [], usedCharacterEffectIdsThisTurn: [], usedCharacterEffectIdsThisRound: [], characterMarks: Object.fromEntries(Object.entries(current.ai.characterMarks ?? {}).filter(([key]) => !key.startsWith("turn:") && !key.startsWith("round:"))) });\n  const marketState',
);

fs.writeFileSync(playtestPath, source);
console.log("Stage 3D Character runtime patch applied successfully.");
