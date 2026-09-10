import { readFile, writeFile } from "node:fs/promises";
import { parseComboRequirements } from "../app/combo-engine.ts";

const cardsPayload = JSON.parse(await readFile(new URL("../content/cards.json", import.meta.url), "utf8"));
const game = JSON.parse(await readFile(new URL("../content/dojo-game.json", import.meta.url), "utf8"));
const combos = (cardsPayload.cards ?? []).filter((card) => String(card.catalogId ?? "").includes("-CMB-CORE-"));

const cards = Object.fromEntries(combos.map((card) => [card.catalogId, {
  name: card.name,
  requirements: parseComboRequirements(card),
}]));

const payload = {
  schemaVersion: 1,
  rulesVersion: game.rulesVersion,
  rulesRevision: game.rulesRevision,
  family: "Combo",
  description: "Canonical machine-readable fulfillment requirements for Core Combos. Materialized once from the legacy parser during Stage 3 final remediation; runtime must never infer these requirements from prose.",
  cards,
};

await writeFile(new URL("../content/combo-requirements.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Materialized ${Object.keys(cards).length} Core Combo requirement definitions.`);
