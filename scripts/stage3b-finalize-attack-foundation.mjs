import { readFileSync, writeFileSync } from "node:fs";

function patch(path, from, to, label) {
  let text = readFileSync(path, "utf8");
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  text = text.replace(from, to);
  writeFileSync(path, text);
}

patch(
  "app/combo-engine.ts",
  'import { finalAttackComboMultiplicity } from "./attack-final-effects";',
  'import cardEffectsJson from "./data/card-effects.json" with { type: "json" };',
  "combo registry import",
);
patch(
  "app/combo-engine.ts",
  '};\n\nexport type ComboContext = {',
  `};

type ComboEffectRegistry = { cards?: Record<string, { effects?: { resolver?: string; amount?: number }[] }> };
const comboEffectRegistry = cardEffectsJson as unknown as ComboEffectRegistry;
function finalAttackComboMultiplicity(card: ComboCardLike) {
  const catalogId = String(card.catalogId ?? "").trim();
  if (!catalogId) return 1;
  return (comboEffectRegistry.cards?.[catalogId]?.effects ?? [])
    .filter((effect) => effect.resolver === "attack.final.comboMultiplicity")
    .reduce((largest, effect) => Math.max(largest, Math.max(1, Number(effect.amount ?? 1))), 1);
}

export type ComboContext = {`,
  "combo multiplicity helper",
);

const guardPath = "tests/playtest-regression-guardrails.test.mjs";
let guard = readFileSync(guardPath, "utf8");
guard = guard.replace(
  '  assert.match(playtest, /focus:\\s*focusBefore - price/);',
  '  assert.match(playtest, /const price = marketPriceFor\\(current\\.player, card\\)/);\n  assert.match(playtest, /spendFocus\\(current\\.player, price\\)/);',
);
if (!guard.includes("spendFocus\\(current\\.player, price\\)")) throw new Error("market Focus guardrail update failed");
writeFileSync(guardPath, guard);
