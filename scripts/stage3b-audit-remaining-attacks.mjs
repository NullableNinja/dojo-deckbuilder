import { readFile, writeFile } from "node:fs/promises";

const cards = JSON.parse(await readFile("content/cards.json", "utf8"));
const registry = JSON.parse(await readFile("content/card-effects.json", "utf8"));
const structured = new Set(Object.keys(registry.cards ?? {}));

const remaining = (cards.cards ?? [])
  .filter((card) => /^DDB-ATK-CORE-\d{3}$/.test(String(card.catalogId ?? "")))
  .filter((card) => !structured.has(card.catalogId))
  .sort((left, right) => String(left.catalogId).localeCompare(String(right.catalogId)))
  .map((card) => ({
    catalogId: card.catalogId,
    name: card.name,
    rulesText: card.rulesText ?? "",
    zone: card.zone ?? null,
    tags: card.tags ?? [],
    focusValue: card.focusValue ?? null,
    fpCost: card.fpCost ?? null,
    stats: card.stats ?? {},
    subtype: card.subtype ?? null,
    details: card.details ?? {},
  }));

const payload = {
  generatedFrom: "content/cards.json + content/card-effects.json",
  structuredAttackCount: Object.keys(registry.cards ?? {}).filter((id) => id.startsWith("DDB-ATK-CORE-")).length,
  remainingAttackCount: remaining.length,
  remaining,
};

await writeFile("stage3b-remaining-attacks.json", JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`Structured Core Attacks: ${payload.structuredAttackCount}`);
console.log(`Remaining Core Attacks: ${payload.remainingAttackCount}`);
