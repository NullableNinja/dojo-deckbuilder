import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const write = (path, content) => writeFile(path, content, "utf8");
const replaceOnce = (text, before, after, label) => {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`Unable to patch ${label}`);
  return text.replace(before, after);
};

let cardEffects = await read("app/card-effects.ts");
if (!cardEffects.includes('"equipment.structured"')) {
  const marker = "const IMPLEMENTED_DEDICATED_RESOLVERS = new Set([";
  const start = cardEffects.indexOf(marker);
  if (start < 0) throw new Error("Unable to find IMPLEMENTED_DEDICATED_RESOLVERS");
  const end = cardEffects.indexOf("]);", start);
  if (end < 0) throw new Error("Unable to find resolver-set end");
  cardEffects = `${cardEffects.slice(0, end)}  \"equipment.structured\",\n${cardEffects.slice(end)}`;
}
cardEffects = cardEffects.replace("  id?: string;\n  trigger?: StructuredEffectTrigger;", "  id?: string;\n  effect?: string;\n  trigger?: StructuredEffectTrigger;");
await write("app/card-effects.ts", cardEffects);

let resolver = await read("app/effect-resolvers.ts");
if (!resolver.includes('from "./equipment-structured"')) {
  resolver = resolver.replace(
    'import cardEffectsJson from "./data/card-effects.json" with { type: "json" };\n',
    'import cardEffectsJson from "./data/card-effects.json" with { type: "json" };\nimport { isStructuredEquipment, structuredAfterDefenseNextAttackBonus, structuredDefenseEquipmentBonus, structuredEquipmentActivationPlan, structuredEquipmentAttackPowerBonus, structuredEquipmentCanChooseAnyZone, structuredEquipmentFirstIncomingPenalty, structuredEquipmentPiercing, structuredEquipmentSpeedModifier, structuredMandatoryDamageReduction, structuredOnEquipPlan, structuredOptionalDamageReduction, structuredPassiveEquipmentGuard, structuredPostBlockCycle, type EquipmentAttackContext, type EquipmentCardLike, type EquipmentDefenseContext } from "./equipment-structured";\n'
  );
}
resolver = resolver.replace(
  "type RegistryEffect = {\n  id?: string;\n  trigger?: string;",
  "type RegistryEffect = {\n  id?: string;\n  effect?: string;\n  trigger?: string;"
);
resolver = resolver.replace(
  "  action?: string;\n  amount?: number;",
  "  action?: string;\n  target?: string;\n  amount?: number;\n  duration?: string;"
);

const renameFunctions = [
  "passiveEquipmentGuard",
  "defenseEquipmentBonus",
  "afterDefenseNextAttackBonus",
  "equipmentSpeedModifier",
  "attackCanChooseAnyZone",
  "equipmentConditionalAttackPowerBonus",
  "firstIncomingAttackPowerPenalty",
  "equipmentPiercing",
  "equipmentActivationPlan",
  "mandatoryDamageReductionEquipment",
  "optionalCombatDamageReductionEquipment",
  "postBlockEquipmentCycle",
];
for (const name of renameFunctions) {
  const exported = `export function ${name}(`;
  const legacy = `function legacy${name[0].toUpperCase()}${name.slice(1)}(`;
  if (resolver.includes(exported)) resolver = resolver.replace(exported, legacy);
}

if (!resolver.includes("// Stage 3B Equipment structured wrappers")) {
  resolver += `\n\n// Stage 3B Equipment structured wrappers. Migrated Equipment is resolved from\n// generated structured data first; prose parsing is only retained for cards with\n// no structured Equipment entry (legacy/unmigrated fixtures and content).\nexport function passiveEquipmentGuard(card: EffectCardLike) {\n  const value = structuredPassiveEquipmentGuard(card as EquipmentCardLike);\n  return value == null ? legacyPassiveEquipmentGuard(card) : value;\n}\n\nexport function defenseEquipmentBonus(card: EffectCardLike, zone: string, context: EquipmentDefenseContext = {}) {\n  const value = structuredDefenseEquipmentBonus(card as EquipmentCardLike, zone, context);\n  return value == null ? legacyDefenseEquipmentBonus(card, zone) : value;\n}\n\nexport function afterDefenseNextAttackBonus(cards: EffectCardLike[]) {\n  const structuredCards = cards.filter((card) => isStructuredEquipment(card as EquipmentCardLike));\n  const legacyCards = cards.filter((card) => !isStructuredEquipment(card as EquipmentCardLike));\n  const structured = structuredAfterDefenseNextAttackBonus(structuredCards as EquipmentCardLike[]);\n  const legacy = legacyAfterDefenseNextAttackBonus(legacyCards);\n  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources] };\n}\n\nexport function equipmentSpeedModifier(card: EffectCardLike) {\n  const value = structuredEquipmentSpeedModifier(card as EquipmentCardLike);\n  return value == null ? legacyEquipmentSpeedModifier(card) : value;\n}\n\nexport function attackCanChooseAnyZone(card: EffectCardLike, firstAttack: boolean, equipment: EffectCardLike[] = []) {\n  const structuredCards = equipment.filter((item) => isStructuredEquipment(item as EquipmentCardLike));\n  const legacyCards = equipment.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));\n  const structured = structuredEquipmentCanChooseAnyZone(structuredCards as EquipmentCardLike[], firstAttack);\n  if (structured.grant) return true;\n  return legacyAttackCanChooseAnyZone(card, firstAttack, legacyCards);\n}\n\nexport function equipmentConditionalAttackPowerBonus(cards: EffectCardLike[], context: { firstAttack: boolean; attackerSpeed: number; defenderSpeed: number } & Partial<EquipmentAttackContext>) {\n  const structuredCards = cards.filter((item) => isStructuredEquipment(item as EquipmentCardLike));\n  const legacyCards = cards.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));\n  const structured = structuredEquipmentAttackPowerBonus(structuredCards as EquipmentCardLike[], context);\n  const legacy = legacyEquipmentConditionalAttackPowerBonus(legacyCards, context);\n  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources], unsupported: structured.unsupported };\n}\n\nexport function firstIncomingAttackPowerPenalty(cards: EffectCardLike[], isFirstIncomingAttack: boolean) {\n  const structuredCards = cards.filter((item) => isStructuredEquipment(item as EquipmentCardLike));\n  const legacyCards = cards.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));\n  const structured = structuredEquipmentFirstIncomingPenalty(structuredCards as EquipmentCardLike[], isFirstIncomingAttack);\n  const legacy = legacyFirstIncomingAttackPowerPenalty(legacyCards, isFirstIncomingAttack);\n  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources] };\n}\n\nexport function equipmentPiercing(cards: EffectCardLike[], context: { firstAttack: boolean; zone: string; matchingArmor: boolean; attackTags?: string[] }) {\n  const structuredCards = cards.filter((item) => isStructuredEquipment(item as EquipmentCardLike));\n  const legacyCards = cards.filter((item) => !isStructuredEquipment(item as EquipmentCardLike));\n  const structured = structuredEquipmentPiercing(structuredCards as EquipmentCardLike[], context);\n  const legacy = legacyEquipmentPiercing(legacyCards, context);\n  return { amount: structured.amount + legacy.amount, sources: [...structured.sources, ...legacy.sources] };\n}\n\nexport function equipmentActivationPlan(card: EffectCardLike): EquipmentActivationPlan | null {\n  const structured = structuredEquipmentActivationPlan(card as EquipmentCardLike);\n  if (structured !== undefined) return structured as EquipmentActivationPlan | null;\n  return legacyEquipmentActivationPlan(card);\n}\n\nexport function mandatoryDamageReductionEquipment(card: EffectCardLike) {\n  const structured = structuredMandatoryDamageReduction(card as EquipmentCardLike);\n  return structured === undefined ? legacyMandatoryDamageReductionEquipment(card) : structured;\n}\n\nexport function optionalCombatDamageReductionEquipment(card: EffectCardLike) {\n  const structured = structuredOptionalDamageReduction(card as EquipmentCardLike);\n  return structured === undefined ? legacyOptionalCombatDamageReductionEquipment(card) : structured;\n}\n\nexport function postBlockEquipmentCycle(card: EffectCardLike) {\n  const structured = structuredPostBlockCycle(card as EquipmentCardLike);\n  return structured === undefined ? legacyPostBlockEquipmentCycle(card) : structured;\n}\n\nexport function equipmentOnEquipPlan(card: EffectCardLike, enteringCard?: EffectCardLike, context: { sourceActivationArmed?: boolean; beltName?: string } = {}) {\n  return structuredOnEquipPlan(card as EquipmentCardLike, enteringCard as EquipmentCardLike | undefined, context) ?? null;\n}\n`;
}
await write("app/effect-resolvers.ts", resolver);

let equipmentRuntime = await read("app/equipment-structured.ts");
if (!equipmentRuntime.includes("const BELT_ORDER")) {
  equipmentRuntime = equipmentRuntime.replace(
    "const registry = cardEffectsJson as unknown as Registry;",
    "const registry = cardEffectsJson as unknown as Registry;\nconst BELT_ORDER = [\"White\", \"Yellow\", \"Orange\", \"Green\", \"Blue\", \"Purple\", \"Brown\", \"Red\", \"Black\"];\nconst beltAtLeast = (actual: unknown, required: unknown) => {\n  const actualIndex = BELT_ORDER.findIndex((belt) => belt.toLocaleLowerCase() === String(actual ?? \"\").toLocaleLowerCase());\n  const requiredIndex = BELT_ORDER.findIndex((belt) => belt.toLocaleLowerCase() === String(required ?? \"\").toLocaleLowerCase());\n  return actualIndex >= 0 && requiredIndex >= 0 && actualIndex >= requiredIndex;\n};"
  );
}
equipmentRuntime = equipmentRuntime.replace(
  '  if (kind === "minimumBelt") return true; // consumed by callers that know Belt ordering.',
  '  if (kind === "minimumBelt") return beltAtLeast(context.beltName, expected);'
);
equipmentRuntime = equipmentRuntime.replace(
  '    if (minimumBelt && !context.beltName) {\n      unsupported.push(effect.id ?? "unknown-on-equip-effect");\n      continue;\n    }',
  '    if (minimumBelt && !beltAtLeast(context.beltName, minimumBelt)) continue;'
);
await write("app/equipment-structured.ts", equipmentRuntime);

let playtest = await read("app/playtest.tsx");
playtest = playtest.replace(
  "equipmentActivationPlan, equipmentConditionalAttackPowerBonus",
  "equipmentActivationPlan, equipmentConditionalAttackPowerBonus, equipmentOnEquipPlan"
);

playtest = replaceOnce(
  playtest,
  "function equipmentDefenseModifier(board: Board, zone: string): CombatModifier {\n  let value = 0;\n  const notes: string[] = [];\n  for (const id of board.equipment) {\n    const card = cardFor(id);\n    if (!card) continue;\n    const bonus = defenseEquipmentBonus(card, zone);",
  "function equipmentDefenseModifier(board: Board, zone: string, context: { weaponAttack?: boolean; firstIncomingAttack?: boolean; hasTempo?: boolean; selfIsLowestXp?: boolean; consumableUsedThisRound?: boolean } = {}): CombatModifier {\n  let value = 0;\n  const notes: string[] = [];\n  for (const id of board.equipment) {\n    const card = cardFor(id);\n    if (!card) continue;\n    const bonus = defenseEquipmentBonus(card, zone, context);",
  "structured Equipment defense context"
);

playtest = replaceOnce(
  playtest,
  "  const equipment = equipmentConditionalAttackPowerBonus(equipped, {\n    firstAttack: attacker.attacksThisTurn === 0,\n    attackerSpeed,\n    defenderSpeed,\n  });",
  "  const equipment = equipmentConditionalAttackPowerBonus(equipped, {\n    firstAttack: attacker.attacksThisTurn === 0,\n    attackNumber: attacker.attacksThisTurn + 1,\n    zone,\n    attackerSpeed,\n    defenderSpeed,\n    targetXpHigher: defender.xp > attacker.xp,\n    targetHasTemporaryNegativeStat: defender.tempSpeed < 0 || (defender.nextDefenseCardBonus ?? 0) < 0 || (defender.nextAttackBonus ?? 0) < 0,\n    hasNotAttackedThisTurn: attacker.attacksThisTurn === 0,\n    firstAttackAfterKataThisTurn: playedKata && !priorAttacks.length,\n    attackTags: card.tags,\n    blockedThisRound: Boolean(attacker.blockedThisRound),\n    hasTwoPairedWeapons: equipped.filter((item) => isWeapon(item) && hasTag(item, \"Paired\")).length >= 2,\n    equippedThisTurnCatalogIds: attacker.cardsThisTurn.map(cardFor).filter((item): item is CardEntry => Boolean(item && isPermanent(item))).map((item) => item.catalogId),\n    currentAttackIsNormal: !isReversal,\n  });",
  "structured Equipment attack context"
);

playtest = playtest.replace(
  "const equipment = equipmentPiercing(equipped, { firstAttack: attacker.attacksThisTurn === 0, zone, matchingArmor });",
  "const equipment = equipmentPiercing(equipped, { firstAttack: attacker.attacksThisTurn === 0, zone, matchingArmor, attackTags: card.tags });"
);

// Mark Consumable use as round state so Armor such as Breakroom Apron Plating can resolve from structured conditions.
playtest = replaceOnce(
  playtest,
  "  if (timing === \"onPlay\") {\n    if (owner === \"player\" || owner === \"ai\") next = gainFocus(next, numberValue(card.focusValue));",
  "  if (timing === \"onPlay\") {\n    if (owner === \"player\" || owner === \"ai\") next = gainFocus(next, numberValue(card.focusValue));\n    if (card.subtype === \"Consumable\") next = { ...next, usedConsumableThisRound: true };",
  "Consumable round state"
);

// Player Equip: structured onEquip effects create a real choice instead of prose parsing.
playtest = replaceOnce(
  playtest,
  "    const nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, \"player\");\n    return write(current, `${card.name} equipped during Initiate. ${cardEffectNote(card)}`, { player: nextPlayer });",
  "    let nextPlayer = applyCardEffects({ ...current.player, hand: removeOne(current.player.hand, id), playArea: [...current.player.playArea, id], cardsThisTurn: [...current.player.cardsThisTurn, id] }, card, \"player\");\n    let pendingChoice: PendingChoice | null = null;\n    const beltName = belts[nextPlayer.belt]?.name ?? \"White\";\n    for (const sourceId of nextPlayer.equipment) {\n      const source = cardFor(sourceId);\n      if (!source) continue;\n      const plan = equipmentOnEquipPlan(source, card, { beltName });\n      if (!plan) continue;\n      if (plan.exhaustSource && !isEquipmentExhausted(nextPlayer, sourceId)) nextPlayer = exhaustEquipment(nextPlayer, sourceId);\n      if (plan.draw) nextPlayer = drawCards(nextPlayer, plan.draw);\n      if (plan.discard) {\n        const count = Math.min(plan.discard, nextPlayer.hand.length);\n        if (count) return write(current, `${card.name} equipped. ${source.name} requires ${count} discard${count === 1 ? \"\" : \"s\"}.`, { player: nextPlayer, pendingDiscard: { sourceCardId: source.id, remaining: count, sourceFollowup: false } });\n      }\n      if (plan.readyOther && (nextPlayer.exhaustedEquipment ?? []).some((candidate) => candidate !== sourceId)) pendingChoice = { kind: \"ready-equipment\", sourceCardId: source.id, optional: true };\n    }\n    return write(current, `${card.name} equipped during Initiate. ${cardEffectNote(card)}`, { player: nextPlayer, pendingChoice });",
  "player onEquip Equipment resolution"
);

// Reset round-scoped Equipment trigger memory at Honor/round advance.
playtest = playtest.replace(
  "combatDamageEventsThisRound: 0, lastAttackHit: false, attackedThisRound: false,",
  "combatDamageEventsThisRound: 0, usedConsumableThisRound: false, lastAttackHit: false, attackedThisRound: false,"
);

await write("app/playtest.tsx", playtest);
console.log("Wired structured Equipment resolvers into card-effects, effect-resolvers, and Quick Duel runtime.");
