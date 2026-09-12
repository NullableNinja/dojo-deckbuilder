import cardsJson from "./data/cards.json" with { type: "json" };

/**
 * Shared runtime view of the generated canonical card catalog.
 *
 * `app/data/cards.json` is generated from `content/cards.json`; consumers should
 * use this loader instead of maintaining parallel card identity/type maps.
 */
export type RuntimeCatalogCard = {
  id: string;
  catalogId?: string;
  name?: string;
  cardType?: string;
  subtype?: string | null;
};

type RuntimeCatalog = { cards?: RuntimeCatalogCard[] };

export const runtimeCards = (cardsJson as unknown as RuntimeCatalog).cards ?? [];

const runtimeCardById = new Map(runtimeCards.map((card) => [card.id, card]));

export function runtimeCardFor(id: string): RuntimeCatalogCard | null {
  return runtimeCardById.get(id) ?? null;
}
