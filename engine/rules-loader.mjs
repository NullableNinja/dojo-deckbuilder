import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

export async function loadGameData() {
  const [definition, catalog, rules, cardEffects] = await Promise.all([
    readJson("app/data/game-definition.json"),
    readJson("app/data/cards.json"),
    readJson("app/data/rules.json"),
    readJson("app/data/card-effects.json"),
  ]);
  if (!rules.version.startsWith(definition.rulesVersion) || !catalog.version.startsWith(definition.rulesVersion)) throw new Error("Rules, card catalog, and engine definition versions must match");
  if (cardEffects.rulesVersion !== definition.rulesVersion || cardEffects.rulesRevision !== definition.rulesRevision) throw new Error("Card-effect registry and engine definition versions must match");
  if (catalog.total !== catalog.cards.length) throw new Error("Card catalog count is corrupt");
  const byId = new Map(catalog.cards.map((card) => [card.catalogId, card]));
  for (const entry of definition.starterDeck) if (!byId.has(entry.catalogId)) throw new Error(`Missing starter card ${entry.catalogId}`);
  const cardEffectById = new Map(Object.entries(cardEffects.cards ?? {}));
  const comboRequirements = await readJson("app/data/combo-requirements.json");
  if (comboRequirements.rulesVersion !== definition.rulesVersion || comboRequirements.rulesRevision !== definition.rulesRevision) throw new Error("Combo requirement registry version does not match engine definition");
  return { definition, cards: catalog.cards, rules, cardEffects, cardEffectById, comboRequirements, byId };
}
