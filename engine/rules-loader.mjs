import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

export async function loadGameData() {
  const [definition, catalog, rules] = await Promise.all([
    readJson("app/data/game-definition.json"),
    readJson("app/data/cards.json"),
    readJson("app/data/rules.json"),
  ]);
  if (!rules.version.startsWith(definition.rulesVersion) || !catalog.version.startsWith(definition.rulesVersion)) throw new Error("Rules, card catalog, and engine definition versions must match");
  if (catalog.total !== catalog.cards.length) throw new Error("Card catalog count is corrupt");
  const byId = new Map(catalog.cards.map((card) => [card.catalogId, card]));
  for (const entry of definition.starterDeck) if (!byId.has(entry.catalogId)) throw new Error(`Missing starter card ${entry.catalogId}`);
  return { definition, cards: catalog.cards, rules, byId };
}
