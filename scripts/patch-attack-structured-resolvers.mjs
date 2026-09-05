import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../app/effect-resolvers.ts", import.meta.url);
let source = await readFile(path, "utf8");

const replaceOnce = (label, before, after) => {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  source = source.replace(before, after);
};

replaceOnce(
  "structured registry helpers",
`function structuredEffects(card: EffectCardLike) {
  const catalogId = String(card.catalogId ?? "").trim();
  return catalogId ? structuredEffectRegistry.cards?.[catalogId]?.effects ?? [] : [];
}

function structuredResolver(card: EffectCardLike, resolver: string) {
  return structuredEffects(card).find((effect) => effect.resolver === resolver) ?? null;
}`,
`function structuredEntry(card: EffectCardLike) {
  const catalogId = String(card.catalogId ?? "").trim();
  return catalogId ? structuredEffectRegistry.cards?.[catalogId] ?? null : null;
}

function structuredEffects(card: EffectCardLike) {
  return structuredEntry(card)?.effects ?? [];
}

function structuredResolvers(card: EffectCardLike, resolver: string) {
  return structuredEffects(card).filter((effect) => effect.resolver === resolver);
}

function structuredResolver(card: EffectCardLike, resolver: string) {
  return structuredResolvers(card, resolver)[0] ?? null;
}`,
);

replaceOnce(
  "structured condition matcher",
`function normalizedMinus(text: string) {
  return text.replace(/[−–—]/g, "-");
}`,
`function normalizedMinus(text: string) {
  return text.replace(/[−–—]/g, "-");
}

function structuredConditionsMatch(effect: RegistryEffect, values: Record<string, unknown>) {
  return (effect.conditions ?? []).every((condition) => {
    const actual = values[String(condition.kind ?? "")];
    const expected = condition.value;
    switch (condition.operator ?? "eq") {
      case "eq": return actual === expected;
      case "neq": return actual !== expected;
      case "gt": return Number(actual) > Number(expected);
      case "gte": return Number(actual) >= Number(expected);
      case "lt": return Number(actual) < Number(expected);
      case "lte": return Number(actual) <= Number(expected);
      case "includes": return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
      case "notIncludes": return Array.isArray(actual) ? !actual.includes(expected) : !String(actual ?? "").includes(String(expected ?? ""));
      default: return false;
    }
  });
}

function structuredConditionValue(effect: RegistryEffect, kind: string) {
  return effect.conditions?.find((condition) => condition.kind === kind)?.value;
}`,
);

replaceOnce(
  "target next Attack penalty",
`export function targetNextAttackPenalty(card: EffectCardLike) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:target|opponent)[’']s next Attack(?: this round)? (?:gets|has) -(\\d+) Attack Power/i);
  return match ? Number(match[1]) : 0;
}`,
`export function targetNextAttackPenalty(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    return structuredResolvers(card, "attack.targetNextAttackPenalty")
      .reduce((total, effect) => total + Math.abs(Number(effect.amount ?? 0)), 0);
  }
  const text = normalizedMinus(String(card.rulesText ?? ""));
  const match = text.match(/(?:target|opponent)[’']s next Attack(?: this round)? (?:gets|has) -(\\d+) Attack Power/i);
  return match ? Number(match[1]) : 0;
}`,
);

replaceOnce(
  "zone declaration resolver",
`export function attackCanChooseAnyZone(card: EffectCardLike, firstAttack: boolean, equipment: EffectCardLike[] = []) {
  if (structuredResolver(card, "attack.chooseAnyZone")) return true;
  const text = String(card.rulesText ?? "");
  if (/Choose High, Mid, or Low when declared/i.test(text)) return true;
  if (/may be declared as Any zone/i.test(text)) return true;
  if (firstAttack && equipment.some((item) => /Your first Attack each turn may be declared as Any zone/i.test(String(item.rulesText ?? "")))) return true;
  return false;
}`,
`export function attackCanChooseAnyZone(card: EffectCardLike, firstAttack: boolean, equipment: EffectCardLike[] = []) {
  if (structuredResolver(card, "attack.chooseAnyZone")) return true;
  if (!structuredEntry(card)) {
    const text = String(card.rulesText ?? "");
    if (/Choose High, Mid, or Low when declared/i.test(text)) return true;
    if (/may be declared as Any zone/i.test(text)) return true;
  }
  if (firstAttack && equipment.some((item) => /Your first Attack each turn may be declared as Any zone/i.test(String(item.rulesText ?? "")))) return true;
  return false;
}`,
);

replaceOnce(
  "conditional Attack Power resolver",
`export function conditionalAttackPowerBonus(card: EffectCardLike, context: { playedKata: boolean; firstAttack: boolean; matchingArmor?: boolean; targetEquipmentCount?: number }) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  let amount = 0;
  const notes: string[] = [];
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
);

replaceOnce(
  "optional discard draw resolver",
`export function optionalDiscardDrawChoice(card: EffectCardLike) {
  const text = String(card.rulesText ?? "");
  const match = text.match(/After (?:this Attack|this|it|that Attack) resolves, you may discard (\\d+) cards? to draw (\\d+) cards?/i);
  return match ? { discard: Number(match[1]), draw: Number(match[2]) } : null;
}`,
`export function optionalDiscardDrawChoice(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    const effect = structuredResolver(card, "attack.optionalDiscardDraw");
    if (!effect) return null;
    return {
      discard: Number(structuredConditionValue(effect, "discardCost") ?? 0),
      draw: Number(structuredConditionValue(effect, "drawAfterCost") ?? 0),
    };
  }
  const text = String(card.rulesText ?? "");
  const match = text.match(/After (?:this Attack|this|it|that Attack) resolves, you may discard (\\d+) cards? to draw (\\d+) cards?/i);
  return match ? { discard: Number(match[1]), draw: Number(match[2]) } : null;
}`,
);

replaceOnce(
  "Attack Piercing resolver",
`export function attackPiercing(card: EffectCardLike, context: {
  matchingArmor: boolean;
  targetEquipmentCount: number;
  targetHasExhaustedEquipment?: boolean;
  speedChangedThisRound?: boolean;
}) {
  const text = normalizedMinus(String(card.rulesText ?? ""));
  let amount = 0;
  const notes: string[] = [];
  const add = (value: number, note: string) => { amount += value; notes.push(note); };

  const armor = text.match(/If the target has matching Armor, this Attack(?: gets \\+\\d+ Attack Power and)? gains Piercing (\\d+)/i);
  if (armor && context.matchingArmor) add(Number(armor[1]), \`matching Armor grants Piercing \${armor[1]}\`);

  const equipment = text.match(/If the target has two or more permanent Equipment cards equipped, this Attack(?: gets \\+\\d+ Attack Power and)? gains Piercing (\\d+)/i);
  if (equipment && context.targetEquipmentCount >= 2) add(Number(equipment[1]), \`loaded target grants Piercing \${equipment[1]}\`);

  const exhausted = text.match(/If the target has exhausted Equipment, this Attack gains Piercing (\\d+)/i);
  if (exhausted && context.targetHasExhaustedEquipment) add(Number(exhausted[1]), \`exhausted Equipment grants Piercing \${exhausted[1]}\`);

  const speed = text.match(/If your Speed changed this round, this Attack gets Piercing (\\d+)/i);
  if (speed && context.speedChangedThisRound) add(Number(speed[1]), \`Speed change grants Piercing \${speed[1]}\`);

  return { amount, notes };
}`,
`export function attackPiercing(card: EffectCardLike, context: {
  matchingArmor: boolean;
  targetEquipmentCount: number;
  targetHasExhaustedEquipment?: boolean;
  speedChangedThisRound?: boolean;
}) {
  let amount = 0;
  const notes: string[] = [];
  const add = (value: number, note: string) => { amount += value; notes.push(note); };
  const entry = structuredEntry(card);
  if (entry) {
    const values = {
      targetHasMatchingArmor: context.matchingArmor,
      targetPermanentEquipmentCount: context.targetEquipmentCount,
      targetHasExhaustedEquipment: Boolean(context.targetHasExhaustedEquipment),
      selfSpeedChangedThisRound: Boolean(context.speedChangedThisRound),
    };
    for (const effect of structuredResolvers(card, "attack.piercing")) {
      if (!structuredConditionsMatch(effect, values)) continue;
      const value = Number(effect.amount ?? 0);
      add(value, \`structured Piercing \${value}\`);
    }
    return { amount, notes };
  }

  const text = normalizedMinus(String(card.rulesText ?? ""));
  const armor = text.match(/If the target has matching Armor, this Attack(?: gets \\+\\d+ Attack Power and)? gains Piercing (\\d+)/i);
  if (armor && context.matchingArmor) add(Number(armor[1]), \`matching Armor grants Piercing \${armor[1]}\`);

  const equipment = text.match(/If the target has two or more permanent Equipment cards equipped, this Attack(?: gets \\+\\d+ Attack Power and)? gains Piercing (\\d+)/i);
  if (equipment && context.targetEquipmentCount >= 2) add(Number(equipment[1]), \`loaded target grants Piercing \${equipment[1]}\`);

  const exhausted = text.match(/If the target has exhausted Equipment, this Attack gains Piercing (\\d+)/i);
  if (exhausted && context.targetHasExhaustedEquipment) add(Number(exhausted[1]), \`exhausted Equipment grants Piercing \${exhausted[1]}\`);

  const speed = text.match(/If your Speed changed this round, this Attack gets Piercing (\\d+)/i);
  if (speed && context.speedChangedThisRound) add(Number(speed[1]), \`Speed change grants Piercing \${speed[1]}\`);

  return { amount, notes };
}`,
);

replaceOnce(
  "ready Equipment on Hit resolver",
`export function readyEquipmentOnHit(card: EffectCardLike) {
  const text = String(card.rulesText ?? "");
  const match = text.match(/If (?:it|this Attack) Hits, you may ready one Equipment card you control/i);
  return match ? 1 : 0;
}`,
`export function readyEquipmentOnHit(card: EffectCardLike) {
  const entry = structuredEntry(card);
  if (entry) {
    return structuredResolvers(card, "attack.readyEquipmentOnHit")
      .reduce((total, effect) => total + Number(effect.amount ?? 0), 0);
  }
  const text = String(card.rulesText ?? "");
  const match = text.match(/If (?:it|this Attack) Hits, you may ready one Equipment card you control/i);
  return match ? 1 : 0;
}`,
);

await writeFile(path, source, "utf8");
console.log("Patched Attack resolvers to consume canonical structured effects before prose fallbacks.");
