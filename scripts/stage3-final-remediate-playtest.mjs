import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceRequired(search, replacement, label = search) {
  if (!source.includes(search)) throw new Error(`Missing expected source for ${label}`);
  source = source.replace(search, replacement);
  console.log(`${label}: replaced`);
}

function replaceRegexRequired(pattern, replacement, label) {
  const matches = source.match(pattern) ?? [];
  if (!matches.length) throw new Error(`Missing expected source for ${label}`);
  source = source.replace(pattern, replacement);
  console.log(`${label}: ${matches.length} replacement(s)`);
}

// The Playtest host must use the Location host bridge directly, not the legacy resolver facade.
replaceRequired(
  'import { structuredLocationDefenseForHost, structuredLocationKataForHost } from "./location-playtest-bridge";',
  'import { structuredLocationAttackForHost, structuredLocationDefenseForHost, structuredLocationKataForHost } from "./location-playtest-bridge";',
  "Location bridge import",
);
replaceRequired(
  'const parsed = locationAttackRuleModifiers(location, {\n    zone,\n    firstAttack,\n    attackTags: card.tags,\n    hasWeapon: equipped.some(isWeapon),\n    equipmentTags: equipped.flatMap((item) => item.tags),\n  });',
  'const parsed = structuredLocationAttackForHost(location, {\n    zone,\n    firstAttack,\n    attackTags: card.tags,\n    hasWeapon: equipped.some(isWeapon),\n    equipmentTags: equipped.flatMap((item) => item.tags),\n  });',
  "Location attack bridge",
);
source = source.replace(/\blocationAttackRuleModifiers,\s*/g, "");

// Character restrictions must be queried from the Character runtime, never fighter names.
replaceRequired(
  '(fighter?.name === "Knuckleton the Brawler" && isWeapon(card))',
  '!characterCanEquip(nextAi, card)',
  "AI Character equip restriction",
);

// Morning-Shift Meditation is a canonical kata.discardBranch effect. Resolve by structured semantics.
replaceRequired(
  'const gainsFocus = source?.name === "Morning-Shift Meditation" && cardFocus(discarded) === 0;',
  'const gainsFocus = Boolean(source && discarded && cardHasRuntimeResolver(source, "kata.discardBranch") && structuredRuntimeResolvers(source, "kata.discardBranch").some((effect) =>\n      effect.action === "gainFocus" && Number(effect.amount ?? 0) > 0 && (effect.conditions ?? []).some((condition) => condition.kind === "discardedFocusValue" && Number(condition.value) === cardFocus(discarded)),\n    ));',
  "structured Kata discard followup",
);

// Core cards are never allowed to fall through to rulesText parsing once their structured handlers run.
replaceRequired(
  'if (structuredAnyZone.handled || structuredFlow.handled) return next;\n  const text = card.rulesText ?? "";',
  'if (structuredAnyZone.handled || structuredFlow.handled) return next;\n  if (card.catalogId.includes("-CORE-")) return next;\n  const text = card.rulesText ?? "";',
  "Core applyCardEffects prose boundary",
);

// Attack Flow for Core cards is decided by canonical structured Attack/Equipment effects only.
replaceRequired(
  'if (structuredFlow.handled) return structuredFlow.hasFlow;\n  if (/this Attack gains Flow/i.test(card.rulesText ?? "")) {',
  'if (structuredFlow.handled) return structuredFlow.hasFlow;\n  if (card.catalogId.includes("-CORE-")) {\n    const pairedWeapons = board.equipment.map(cardFor).filter((item): item is CardEntry => Boolean(item && isWeapon(item) && hasTag(item, "Paired")));\n    const attackNumber = board.attacksThisTurn + 1;\n    return pairedWeapons.length >= 2 && board.equipment.some((id) => {\n      const item = cardFor(id);\n      return Boolean(item && structuredRuntimeResolvers(item, "equipment.structured").some((effect) => {\n        if (effect.effect !== "combat.grantFlow" || effect.trigger !== "onAttackDeclared") return false;\n        const attackNumberCondition = (effect.conditions ?? []).find((condition) => condition.kind === "attackNumber");\n        const pairedCondition = (effect.conditions ?? []).find((condition) => condition.kind === "hasTwoPairedWeapons");\n        return Number(attackNumberCondition?.value ?? -1) === attackNumber && pairedCondition?.value === true;\n      }));\n    });\n  }\n  if (/this Attack gains Flow/i.test(card.rulesText ?? "")) {',
  "Core attack Flow prose boundary",
);
replaceRegexRequired(
  /\n  const pairedWeapons = board\.equipment\.map\(cardFor\)\.filter\(\(item\): item is CardEntry => Boolean\(item && isWeapon\(item\) && hasTag\(item, "Paired"\)\)\);\n  if \(board\.attacksThisTurn === 1 && pairedWeapons\.length >= 2 && board\.equipment\.some\(\(id\) => cardFor\(id\)\?\.name === "Escrima Sticks"\)\) return true;/g,
  '',
  "Equipment name Flow shortcut",
);

// The legacy prose compiler is not part of the Playtest runtime surface.
source = source.replace('import { compileCardEffects, describeEffectPlan, effectPlanForCard } from "./card-effects";', 'import { describeEffectPlan, effectPlanForCard } from "./card-effects";');

const bannedGameplayTokens = [
  'fighter?.name === "Knuckleton the Brawler"',
  'source?.name === "Morning-Shift Meditation"',
  'cardFor(id)?.name === "Escrima Sticks"',
  'locationAttackRuleModifiers(location',
  'compileCardEffects(',
];
for (const token of bannedGameplayTokens) {
  if (source.includes(token)) throw new Error(`Structured host remediation left banned gameplay token: ${token}`);
}

fs.writeFileSync(path, source);
console.log("Stage 3 structured host/prose-boundary remediation written.");
