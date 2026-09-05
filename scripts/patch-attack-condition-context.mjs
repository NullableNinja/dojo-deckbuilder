import { readFile, writeFile } from "node:fs/promises";

const resolverPath = new URL("../app/effect-resolvers.ts", import.meta.url);
const playtestPath = new URL("../app/playtest.tsx", import.meta.url);
let resolver = await readFile(resolverPath, "utf8");
let playtest = await readFile(playtestPath, "utf8");

const replaceOnce = (source, label, before, after) => {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  return source.replace(before, after);
};

resolver = replaceOnce(
  resolver,
  "target Speed penalty resolver",
`export function targetSpeedPenaltyUntilHonor(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:target(?:[’']s active Character)?|opponent) gets? -(\\d+) Speed until (?:the )?next Honor Phase/i);
  return match ? Number(match[1]) : 0;
}`,
`export function targetSpeedPenaltyUntilHonor(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    return structuredResolvers(card, "attack.targetSpeedPenaltyUntilHonor")
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:target(?:[’']s active Character)?|opponent) gets? -(\\d+) Speed until (?:the )?next Honor Phase/i);
  return match ? Number(match[1]) : 0;
}`,
);

resolver = replaceOnce(
  resolver,
  "expanded structured Attack Power context",
`export function conditionalAttackPowerBonus(card: EffectCardLike, context: { playedKata: boolean; firstAttack: boolean; matchingArmor?: boolean; targetEquipmentCount?: number }) {
  let amount = 0;
  const notes: string[] = [];
  const entry = structuredEntry(card);
  if (entry) {
    const values = {
      playedKataThisTurn: context.playedKata,
      firstAttackThisTurn: context.firstAttack,
      targetHasMatchingArmor: Boolean(context.matchingArmor),
      targetPermanentEquipmentCount: context.targetEquipmentCount ?? 0,
    };
    for (const effect of structuredResolvers(card, "attack.conditionalPower")) {
      if (!structuredConditionsMatch(effect, values)) continue;
      const value = Number(effect.amount ?? 0);
      amount += value;
      notes.push(\`structured condition \${value >= 0 ? "+" : ""}\${value} Attack Power\`);
    }
    return { amount, notes };
  }
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const kata = text.match(/If you played a Kata this turn, this Attack gets \\+(\\d+) Attack Power/i);
  if (kata && context.playedKata) { amount += Number(kata[1]); notes.push(\`Kata setup +\${kata[1]} Attack Power\`); }
  const armor = text.match(/If the target has matching Armor, this Attack gets \\+(\\d+) Attack Power/i);
  if (armor && context.matchingArmor) { amount += Number(armor[1]); notes.push(\`matching Armor +\${armor[1]} Attack Power\`); }
  const equipment = text.match(/If the target has two or more permanent Equipment cards equipped, this Attack gets \\+(\\d+) Attack Power/i);
  if (equipment && (context.targetEquipmentCount ?? 0) >= 2) { amount += Number(equipment[1]); notes.push(\`loaded target +\${equipment[1]} Attack Power\`); }
  const unconditional = text.match(/(?:^|[.!?]\\s+)(?:This|The) Attack gets \\+(\\d+) Attack Power/i);
  if (unconditional && !/Payoff:/i.test(text)) { amount += Number(unconditional[1]); notes.push(\`printed Attack bonus +\${unconditional[1]}\`); }
  return { amount, notes };
}`,
`export function conditionalAttackPowerBonus(card: EffectCardLike, context: {
  playedKata: boolean;
  firstAttack: boolean;
  matchingArmor?: boolean;
  targetEquipmentCount?: number;
  attackNumber?: number;
  hasTempo?: boolean;
  hasFewerCardsThanTarget?: boolean;
  targetSpeedHigher?: boolean;
  priorLowAttack?: boolean;
  previousCardIsItemOrConsumable?: boolean;
  hasImprovisedWeapon?: boolean;
  wasHitSinceLastTurn?: boolean;
  differentZoneFromPreviousAttack?: boolean;
  previousAttackZoneMidOrHigh?: boolean;
  priorDifferentZoneCount?: number;
  priorPunchAttack?: boolean;
  priorSpinAttack?: boolean;
}) {
  let amount = 0;
  const notes: string[] = [];
  const entry = structuredEntry(card);
  if (entry) {
    const values = {
      playedKataThisTurn: context.playedKata,
      firstAttackThisTurn: context.firstAttack,
      targetHasMatchingArmor: Boolean(context.matchingArmor),
      targetPermanentEquipmentCount: context.targetEquipmentCount ?? 0,
      attackNumber: context.attackNumber ?? (context.firstAttack ? 1 : 0),
      hasTempo: Boolean(context.hasTempo),
      hasFewerCardsThanTarget: Boolean(context.hasFewerCardsThanTarget),
      targetSpeedHigher: Boolean(context.targetSpeedHigher),
      priorLowAttack: Boolean(context.priorLowAttack),
      previousCardIsItemOrConsumable: Boolean(context.previousCardIsItemOrConsumable),
      hasImprovisedWeapon: Boolean(context.hasImprovisedWeapon),
      wasHitSinceLastTurn: Boolean(context.wasHitSinceLastTurn),
      differentZoneFromPreviousAttack: Boolean(context.differentZoneFromPreviousAttack),
      previousAttackZoneMidOrHigh: Boolean(context.previousAttackZoneMidOrHigh),
      priorDifferentZoneCount: context.priorDifferentZoneCount ?? 0,
      priorPunchAttack: Boolean(context.priorPunchAttack),
      priorSpinAttack: Boolean(context.priorSpinAttack),
    };
    for (const effect of structuredResolvers(card, "attack.conditionalPower")) {
      if (!structuredConditionsMatch(effect, values)) continue;
      const value = Number(effect.amount ?? 0);
      amount += value;
      notes.push(\`structured condition \${value >= 0 ? "+" : ""}\${value} Attack Power\`);
    }
    return { amount, notes };
  }
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const kata = text.match(/If you played a Kata this turn, this Attack gets \\+(\\d+) Attack Power/i);
  if (kata && context.playedKata) { amount += Number(kata[1]); notes.push(\`Kata setup +\${kata[1]} Attack Power\`); }
  const armor = text.match(/If the target has matching Armor, this Attack gets \\+(\\d+) Attack Power/i);
  if (armor && context.matchingArmor) { amount += Number(armor[1]); notes.push(\`matching Armor +\${armor[1]} Attack Power\`); }
  const equipment = text.match(/If the target has two or more permanent Equipment cards equipped, this Attack gets \\+(\\d+) Attack Power/i);
  if (equipment && (context.targetEquipmentCount ?? 0) >= 2) { amount += Number(equipment[1]); notes.push(\`loaded target +\${equipment[1]} Attack Power\`); }
  const unconditional = text.match(/(?:^|[.!?]\\s+)(?:This|The) Attack gets \\+(\\d+) Attack Power/i);
  if (unconditional && !/Payoff:/i.test(text)) { amount += Number(unconditional[1]); notes.push(\`printed Attack bonus +\${unconditional[1]}\`); }
  return { amount, notes };
}`,
);

playtest = replaceOnce(
  playtest,
  "Quick Duel structured Attack context",
`function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry, zone: string): AttackModifier {
  const playedKata = attacker.cardsThisTurn.some((id) => { const prior = cardFor(id); return Boolean(prior && isKata(prior)); });
  const printed = conditionalAttackPowerBonus(card, {
    playedKata,
    firstAttack: attacker.attacksThisTurn === 0,
    matchingArmor: equipmentDefenseModifier(defender, zone).value > 0,
    targetEquipmentCount: defender.equipment.length,
  });
  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));`,
`function printedAttackRuleModifier(attacker: Board, defender: Board, card: CardEntry, zone: string): AttackModifier {
  const priorCards = attacker.cardsThisTurn.map(cardFor).filter((prior): prior is CardEntry => Boolean(prior));
  const priorAttacks = priorCards.filter(isAttack);
  const playedKata = priorCards.some(isKata);
  const previousCard = priorCards.at(-1);
  const previousZone = attacker.zonesPlayed.at(-1);
  const equipped = attacker.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item));
  const attackerSpeed = fighterStat(attacker, "Speed");
  const defenderSpeed = fighterStat(defender, "Speed");
  const printed = conditionalAttackPowerBonus(card, {
    playedKata,
    firstAttack: attacker.attacksThisTurn === 0,
    matchingArmor: equipmentDefenseModifier(defender, zone).value > 0,
    targetEquipmentCount: defender.equipment.length,
    attackNumber: attacker.attacksThisTurn + 1,
    hasTempo: attacker.tempo,
    hasFewerCardsThanTarget: attacker.hand.length < defender.hand.length,
    targetSpeedHigher: defenderSpeed > attackerSpeed,
    priorLowAttack: attacker.zonesPlayed.some((priorZone) => priorZone.toLocaleLowerCase() === "low"),
    previousCardIsItemOrConsumable: Boolean(previousCard && (previousCard.cardType === "Item" || previousCard.subtype === "Consumable")),
    hasImprovisedWeapon: equipped.some((item) => isWeapon(item) && hasTag(item, "Improvised")),
    wasHitSinceLastTurn: attacker.wasHitSinceLastTurn,
    differentZoneFromPreviousAttack: Boolean(previousZone && previousZone.toLocaleLowerCase() !== zone.toLocaleLowerCase()),
    previousAttackZoneMidOrHigh: Boolean(previousZone && ["mid", "high"].includes(previousZone.toLocaleLowerCase())),
    priorDifferentZoneCount: new Set(attacker.zonesPlayed.map((priorZone) => priorZone.toLocaleLowerCase())).size,
    priorPunchAttack: priorAttacks.some((prior) => hasTag(prior, "Punch")),
    priorSpinAttack: priorAttacks.some((prior) => hasTag(prior, "Spin")),
  });`,
);

playtest = replaceOnce(
  playtest,
  "reuse structured Speed values",
`  const equipment = equipmentConditionalAttackPowerBonus(equipped, {
    firstAttack: attacker.attacksThisTurn === 0,
    attackerSpeed: fighterStat(attacker, "Speed"),
    defenderSpeed: fighterStat(defender, "Speed"),
  });`,
`  const equipment = equipmentConditionalAttackPowerBonus(equipped, {
    firstAttack: attacker.attacksThisTurn === 0,
    attackerSpeed,
    defenderSpeed,
  });`,
);

await Promise.all([
  writeFile(resolverPath, resolver, "utf8"),
  writeFile(playtestPath, playtest, "utf8"),
]);
console.log("Patched Quick Duel and Attack resolvers with canonical condition context.");
