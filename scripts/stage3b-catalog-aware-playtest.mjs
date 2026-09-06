import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

const replacements = [
  [
    'import { compileCardEffects, describeEffectPlan } from "./card-effects";',
    'import { compileCardEffects, describeEffectPlan, effectPlanForCard } from "./card-effects";',
  ],
  [
    'return describeEffectPlan(compileCardEffects(text));',
    'return describeEffectPlan(effectPlanForCard(card));',
  ],
  [
    'return compileCardEffects(card.rulesText ?? "").effects\n    .filter((effect) => effect.timing === timing && effect.kind === "discard")',
    'return effectPlanForCard(card).effects\n    .filter((effect) => effect.timing === timing && effect.kind === "discard")',
  ],
  [
    'for (const effect of compileCardEffects(card.rulesText ?? "").effects.filter((entry) => entry.timing === timing)) {',
    'for (const effect of effectPlanForCard(card).effects.filter((entry) => entry.timing === timing)) {',
  ],
];

for (const [before, after] of replacements) {
  if (source.includes(after)) continue;
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one occurrence of migration target, found ${occurrences}: ${before}`);
  }
  source = source.replace(before, after);
}

const remainingRuntimeTextCalls = [...source.matchAll(/compileCardEffects\(card\.rulesText/g)].length;
if (remainingRuntimeTextCalls !== 0) {
  throw new Error(`Expected zero card.rulesText compileCardEffects call sites after migration, found ${remainingRuntimeTextCalls}`);
}

fs.writeFileSync(path, source);
