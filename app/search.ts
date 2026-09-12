import cardsJson from "./data/cards.json";
import { CANONICAL_RULES } from "./canonical-presentation";
import type { SiteRoute } from "./routing";

export type CardEntry = {
  id: string;
  name: string;
  cardType: string;
  subtype: string;
  category?: string | null;
  catalogId: string;
  catalogOrder: number;
  deck: string;
  rulesVersion: string;
  lineage?: string | null;
  availability?: string;
  v2Status?: string;
  fpCost?: string | number | null;
  chiCost?: string | number | null;
  focusValue?: string | number | null;
  zone?: string | null;
  timing?: string | null;
  rulesText?: string | null;
  flavorText?: string | null;
  tags: string[];
  buildPaths: string[];
  stats: Record<string, string | number>;
  image?: string | null;
  sourceSheet: string;
  sourceRulesVersion?: string | null;
  searchText?: string;
  details: Record<string, string | number>;
};

type RuleBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "table"; rows: (string | number)[][] };
type RuleSection = { id: string; title: string; content: RuleBlock[] };
type RuleChapter = { id: string; number: number; title: string; fullTitle?: string; intro: RuleBlock[]; sections: RuleSection[] };
type OfficialRuling = { id: string; filed: string; tag: string; title: string; ruling: string };
type GlossaryEntry = { term: string; meaning: string };
type HouseRule = { id?: string; name: string; rule: string; category?: string; summary?: string; notes?: string };

type SearchRulesData = {
  chapters: RuleChapter[];
  officialRulings: OfficialRuling[];
  glossary: GlossaryEntry[];
  houseRules: HouseRule[];
};

export type SearchResultType = "card" | "rule" | "glossary" | "ruling" | "house-rule";

export type SearchResult = {
  type: SearchResultType;
  title: string;
  detail: string;
  body: string;
  identifier?: string;
  route: SiteRoute;
};

export const SEARCH_GROUP_ORDER: SearchResultType[] = ["card", "rule", "glossary", "ruling", "house-rule"];
export const SEARCH_GROUP_LABELS: Record<SearchResultType, string> = {
  card: "Cards",
  rule: "Rules",
  glossary: "Glossary",
  ruling: "Official Rulings",
  "house-rule": "House Rules",
};
export const SEARCH_GROUP_NOTES: Record<SearchResultType, string> = {
  card: "Fighters, techniques, gear, locations & more",
  rule: "Canonical chapters and sections from the rulebook",
  glossary: "Game terms and plain-language definitions",
  ruling: "Official rulings, clarifications and errata",
  "house-rule": "Optional variants for extra dojo chaos",
};

const cardData = cardsJson as unknown as { cards: CardEntry[] };
const rulesData = CANONICAL_RULES as unknown as SearchRulesData;
const ruleChapters = rulesData.chapters.filter((chapter) => chapter.number >= 1 && chapter.number <= 16);

export const ALL_CARDS = cardData.cards;
export const ALL_GLOSSARY_ENTRIES = Array.from(
  new Map(rulesData.glossary.map((entry) => [normalizeSearchQuery(entry.term), entry])).values(),
).sort((a, b) => a.term.localeCompare(b.term));

export function normalizeSearchQuery(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

const valueLabel = (value: string | number | null | undefined) => value === null || value === undefined || value === "" ? "—" : String(value);

export const publicCardDetails = (card: CardEntry): [string, string | number][] => [
  ["Focus Cost", valueLabel(card.fpCost)],
  ["Focus Value", valueLabel(card.focusValue)],
  ["Stats", Object.entries(card.stats).map(([key, value]) => `${key}: ${value}`).join("; ") || "—"],
  ["Tags", card.tags.join(", ") || "—"],
  ["Build Paths", card.buildPaths.join(", ") || "—"],
  ["Availability", card.availability ?? "—"],
  ["Design Purpose", card.details["Design Purpose"] ?? "—"],
  ["Playtest Focus", card.details["Playtest Focus"] ?? "—"],
  ["Source Version", card.sourceRulesVersion ?? "—"],
];

export const cardSearchText = (card: CardEntry) => normalizeSearchQuery([
  card.catalogId,
  card.name,
  card.cardType,
  card.subtype,
  card.category,
  card.deck,
  card.lineage,
  card.zone,
  card.timing,
  card.rulesText,
  card.flavorText,
  ...card.tags,
  ...card.buildPaths,
  ...Object.keys(card.stats),
  ...Object.values(card.stats),
  ...publicCardDetails(card).flatMap(([key, value]) => [key, value]),
].filter((value) => value !== null && value !== undefined && value !== "").join(" "));

const ruleBlockText = (blocks: RuleBlock[]) => blocks.flatMap((block) => block.kind === "table" ? block.rows.flat().map(String) : [block.text]).join(" ");
const displayRuleNumber = (chapter: RuleChapter) => String(ruleChapters.findIndex((entry) => entry.id === chapter.id) + 1).padStart(2, "0");

const resultRank = (result: SearchResult, normalizedTerm: string) => {
  const title = normalizeSearchQuery(result.title);
  const detail = normalizeSearchQuery(result.detail);
  const identifier = normalizeSearchQuery(result.identifier ?? "");
  const body = normalizeSearchQuery(result.body);

  if (title === normalizedTerm || identifier === normalizedTerm) return 0;
  if (title.startsWith(normalizedTerm)) return 1;
  if (title.includes(normalizedTerm)) return 2;
  if (identifier.startsWith(normalizedTerm) || identifier.includes(normalizedTerm)) return 3;
  if (detail.startsWith(normalizedTerm)) return 4;
  if (detail.includes(normalizedTerm)) return 5;
  return body.includes(normalizedTerm) ? 6 : 7;
};

const ruleResults = (term: string): SearchResult[] => ruleChapters.flatMap((chapter) => {
  const chapterIntro = ruleBlockText(chapter.intro);
  const chapterHaystack = normalizeSearchQuery(`${chapter.id} ${chapter.title} ${chapter.fullTitle ?? ""} ${chapterIntro}`);
  const matchingSections = chapter.sections.filter((section) => normalizeSearchQuery(`${section.id} ${section.title} ${ruleBlockText(section.content)}`).includes(term));
  const results: SearchResult[] = matchingSections.map((section) => ({
    type: "rule",
    title: section.title,
    detail: `Chapter ${displayRuleNumber(chapter)} · ${chapter.title}`,
    body: ruleBlockText(section.content),
    identifier: `${chapter.id}/${section.id}`,
    route: { page: "rules", chapterId: chapter.id, sectionId: section.id },
  }));
  if (results.length === 0 && chapterHaystack.includes(term)) {
    results.push({
      type: "rule",
      title: chapter.title,
      detail: `Chapter ${displayRuleNumber(chapter)} · overview`,
      body: chapterIntro,
      identifier: chapter.id,
      route: { page: "rules", chapterId: chapter.id },
    });
  }
  return results;
});

export function searchDojo(query: string): SearchResult[] {
  const term = normalizeSearchQuery(query);
  if (term.length < 2) return [];

  const cards: SearchResult[] = cardData.cards
    .filter((card) => cardSearchText(card).includes(term))
    .map((card) => ({
      type: "card",
      title: card.name,
      detail: `${card.catalogId} · ${card.cardType} · ${card.subtype}`,
      body: cardSearchText(card),
      identifier: card.catalogId,
      route: { page: "cards", cardId: card.catalogId },
    }));

  const glossary: SearchResult[] = ALL_GLOSSARY_ENTRIES
    .filter((entry) => normalizeSearchQuery(`${entry.term} ${entry.meaning}`).includes(term))
    .map((entry) => ({
      type: "glossary",
      title: entry.term,
      detail: entry.meaning,
      body: entry.meaning,
      identifier: entry.term,
      route: { page: "glossary", term: entry.term },
    }));

  const rulings: SearchResult[] = rulesData.officialRulings
    .filter((entry) => normalizeSearchQuery(`${entry.id} ${entry.filed} ${entry.tag} ${entry.title} ${entry.ruling}`).includes(term))
    .map((entry) => ({
      type: "ruling",
      title: entry.title,
      detail: `${entry.id} · ${entry.tag} · ${entry.filed}`,
      body: entry.ruling,
      identifier: entry.id,
      route: { page: "rulings", tab: "official", query: entry.id },
    }));

  const houseRules: SearchResult[] = rulesData.houseRules
    .filter((entry) => normalizeSearchQuery(`${entry.id ?? ""} ${entry.name} ${entry.rule} ${entry.category ?? ""} ${entry.summary ?? ""} ${entry.notes ?? ""}`).includes(term))
    .map((entry) => ({
      type: "house-rule",
      title: entry.name,
      detail: entry.summary || entry.rule,
      body: `${entry.rule} ${entry.notes ?? ""}`,
      identifier: entry.id ?? entry.name,
      route: { page: "rulings", tab: "house", query: entry.name },
    }));

  return [...cards, ...ruleResults(term), ...glossary, ...rulings, ...houseRules]
    .sort((a, b) => resultRank(a, term) - resultRank(b, term)
      || SEARCH_GROUP_ORDER.indexOf(a.type) - SEARCH_GROUP_ORDER.indexOf(b.type)
      || a.title.localeCompare(b.title));
}

export const groupSearchResults = (results: SearchResult[]) => SEARCH_GROUP_ORDER
  .map((type) => ({ type, results: results.filter((result) => result.type === type) }))
  .filter((group) => group.results.length > 0);

export const searchResultRank = (result: SearchResult, query: string) => resultRank(result, normalizeSearchQuery(query));
