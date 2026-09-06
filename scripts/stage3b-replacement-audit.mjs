import { readFile } from "node:fs/promises";

const catalogJson = JSON.parse(await readFile("content/cards.json", "utf8"));
const registryJson = JSON.parse(await readFile("content/card-effects.json", "utf8"));
const cards = Array.isArray(catalogJson) ? catalogJson : (catalogJson.cards ?? []);
const migrated = new Set(Object.keys(registryJson.cards ?? {}));

const remaining = cards
  .filter((card) => String(card.catalogId ?? "").startsWith("DDB-ATK-CORE-"))
  .filter((card) => !migrated.has(card.catalogId))
  .sort((a, b) => String(a.catalogId).localeCompare(String(b.catalogId)));

console.log(`REMAINING_CORE_ATTACKS=${remaining.length}`);
for (const card of remaining) {
  console.log(JSON.stringify({
    catalogId: card.catalogId,
    name: card.name,
    zone: card.zone ?? null,
    rulesText: card.rulesText ?? "",
    tags: card.tags ?? [],
    fpCost: card.fpCost ?? null,
    focusValue: card.focusValue ?? null,
  }));
}
