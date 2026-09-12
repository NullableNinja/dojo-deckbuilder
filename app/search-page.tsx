import { useEffect, useMemo, useState } from "react";
import cardsJson from "./data/cards.json";
import rulesJson from "./data/rules.json";
import "./search-page.css";

type CardEntry = {
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

type RuleSection = { id: string; title: string; [key: string]: unknown };
type RuleChapter = { id: string; number: number; title: string; sections: RuleSection[]; [key: string]: unknown };
type HouseRule = { name: string; rule: string; category?: string; summary?: string; notes?: string };
type OfficialRuling = { id: string; filed: string; tag: string; title: string; ruling: string };
type GlossaryEntry = { term: string; meaning: string };
type SearchResultType = "Card" | "Rule" | "Glossary" | "Ruling" | "House Rule";
type SearchResult = { type: SearchResultType; title: string; detail: string; hash: string };

type CardData = { cards: CardEntry[] };
type RulesData = {
  chapters: RuleChapter[];
  officialRulings: OfficialRuling[];
  glossary: GlossaryEntry[];
  houseRules: HouseRule[];
};

const cardData = cardsJson as unknown as CardData;
const rulesData = rulesJson as unknown as RulesData;
const ruleChapters = rulesData.chapters.filter((chapter) => chapter.number >= 1 && chapter.number <= 16);
const SEARCH_GROUP_ORDER: SearchResultType[] = ["Card", "Rule", "Glossary", "Ruling", "House Rule"];
const SEARCH_GROUP_LABELS: Record<SearchResultType, string> = {
  Card: "Cards",
  Rule: "Rules",
  Glossary: "Glossary",
  Ruling: "Rulings",
  "House Rule": "House Rules",
};
const LOCATION_CHANGE_EVENT = "ddb-locationchange";

const glossaryKey = (term: string) => term.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const glossaryEntries = Array.from(new Map(rulesData.glossary.map((entry) => [glossaryKey(entry.term), entry])).values()).sort((a, b) => a.term.localeCompare(b.term));
const displayRuleNumber = (chapter: RuleChapter) => String(ruleChapters.findIndex((entry) => entry.id === chapter.id) + 1).padStart(2, "0");
const valueLabel = (value: string | number | null | undefined) => value === null || value === undefined || value === "" ? "—" : String(value);
const publicCardDetails = (card: CardEntry): [string, string | number][] => [
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
const cardSearchText = (card: CardEntry) => [
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
].filter((value) => value !== null && value !== undefined && value !== "").join(" ").toLocaleLowerCase();

const searchResultRank = (result: SearchResult, term: string) => {
  const title = result.title.toLocaleLowerCase();
  const detail = result.detail.toLocaleLowerCase();
  if (title === term || detail === term || detail.startsWith(`${term} ·`)) return 0;
  if (title.startsWith(term)) return 1;
  if (title.includes(term)) return 2;
  if (detail.startsWith(term)) return 3;
  return 4;
};

const routeHash = (view: string, detail?: string, subdetail?: string) => `#${[view, detail, subdetail]
  .filter((part): part is string => Boolean(part))
  .map((part, index) => index === 0 ? part : encodeURIComponent(part))
  .join("/")}`;

const decodeHashPart = (value = "") => {
  try { return decodeURIComponent(value); } catch { return value; }
};

const readSearchRoute = () => {
  if (typeof window === "undefined") return { active: false, query: "" };
  const [view, detail = ""] = window.location.hash.replace(/^#/, "").split("/");
  return { active: view === "search", query: view === "search" ? decodeHashPart(detail) : "" };
};

const searchDojo = (query: string): SearchResult[] => {
  const term = query.trim().toLocaleLowerCase();
  if (term.length < 2) return [];

  const rules: SearchResult[] = ruleChapters.flatMap((chapter): SearchResult[] => {
    if (!JSON.stringify(chapter).toLocaleLowerCase().includes(term)) return [];
    const section = chapter.sections.find((entry) => JSON.stringify(entry).toLocaleLowerCase().includes(term));
    return [{
      type: "Rule",
      title: chapter.title,
      detail: section ? `Chapter ${displayRuleNumber(chapter)} · ${section.title}` : `Chapter ${displayRuleNumber(chapter)} · overview`,
      hash: routeHash("rules", chapter.id, section?.id),
    }];
  });
  const rulings: SearchResult[] = rulesData.officialRulings
    .filter((entry) => Object.values(entry).join(" ").toLocaleLowerCase().includes(term))
    .map(({ id, filed, tag, title }) => ({ type: "Ruling", title, detail: `${id} · ${tag} · ${filed}`, hash: routeHash("rulings", id) }));
  const cards: SearchResult[] = cardData.cards
    .filter((card) => cardSearchText(card).includes(term))
    .map((card) => ({ type: "Card", title: card.name, detail: `${card.catalogId} · ${card.cardType} · ${card.subtype}`, hash: routeHash("cards", card.catalogId) }));
  const terms: SearchResult[] = glossaryEntries
    .filter((entry) => `${entry.term} ${entry.meaning}`.toLocaleLowerCase().includes(term))
    .map((entry) => ({ type: "Glossary", title: entry.term, detail: entry.meaning, hash: routeHash("glossary", entry.term) }));
  const houseRules: SearchResult[] = rulesData.houseRules
    .filter((entry) => `${entry.name} ${entry.rule} ${entry.summary ?? ""} ${entry.notes ?? ""}`.toLocaleLowerCase().includes(term))
    .map((entry) => ({ type: "House Rule", title: entry.name, detail: entry.summary || entry.rule, hash: routeHash("house-rules", entry.name) }));

  return [...rules, ...rulings, ...cards, ...terms, ...houseRules]
    .sort((a, b) => searchResultRank(a, term) - searchResultRank(b, term)
      || SEARCH_GROUP_ORDER.indexOf(a.type) - SEARCH_GROUP_ORDER.indexOf(b.type)
      || a.title.localeCompare(b.title));
};

const searchGroupId = (type: SearchResultType) => `search-${type.toLocaleLowerCase().replace(/\s+/g, "-")}`;

const clearQuickSearch = () => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  document.querySelectorAll<HTMLInputElement>(".header-search input, .mobile-global-search input").forEach((input) => {
    if (valueSetter) valueSetter.call(input, "");
    else input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.blur();
  });
};

export default function SearchPage() {
  const initialRoute = readSearchRoute();
  const [active, setActive] = useState(initialRoute.active);
  const [query, setQuery] = useState(initialRoute.query);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    const notify = () => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));

    window.history.pushState = ((...args: Parameters<History["pushState"]>) => {
      originalPushState.apply(window.history, args);
      notify();
    }) as History["pushState"];
    window.history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      originalReplaceState.apply(window.history, args);
      notify();
    }) as History["replaceState"];

    const syncRoute = () => {
      const route = readSearchRoute();
      setActive(route.active);
      if (route.active) setQuery(route.query);
    };
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    window.addEventListener(LOCATION_CHANGE_EVENT, syncRoute);
    syncRoute();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener(LOCATION_CHANGE_EVENT, syncRoute);
    };
  }, []);

  useEffect(() => {
    const openFullSearch = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches(".header-search input, .mobile-global-search input")) return;
      const nextQuery = target.value.trim();
      if (nextQuery.length < 2) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      document.querySelector<HTMLButtonElement>(".mobile-menu-close")?.click();
      window.history.pushState(null, "", routeHash("search", nextQuery));
      target.blur();
    };

    document.addEventListener("keydown", openFullSearch, true);
    return () => document.removeEventListener("keydown", openFullSearch, true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("ddb-search-page", active);
    return () => document.body.classList.remove("ddb-search-page");
  }, [active]);

  const results = useMemo(() => searchDojo(query), [query]);
  const groups = useMemo(() => SEARCH_GROUP_ORDER
    .map((type) => ({ type, results: results.filter((result) => result.type === type) }))
    .filter((group) => group.results.length > 0), [results]);

  if (!active) return null;

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    const trimmed = nextQuery.trim();
    window.history.replaceState(null, "", trimmed ? routeHash("search", trimmed) : "#search");
  };

  const openResult = (result: SearchResult) => {
    clearQuickSearch();
    window.setTimeout(() => {
      window.location.hash = result.hash;
    }, 0);
  };

  return <main className="search-page shell page-shell" aria-labelledby="dojo-search-title">
    <header className="search-page-hero paper-stack">
      <span className="eyebrow">Department-wide search</span>
      <div className="search-page-heading">
        <div>
          <h1 id="dojo-search-title">Spread the files out.</h1>
          <p>The quick search is for a direct hit. This page lays every match on the desk and sorts it by where it lives.</p>
        </div>
        <span className="search-page-stamp" aria-hidden="true">⌕</span>
      </div>
      <label className="search-page-input">
        <span>Search cards, rules, rulings, glossary, and house rules</span>
        <div><b aria-hidden="true">⌕</b><input autoFocus value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Try Tempo, High, ferret, knockout…" /></div>
      </label>
      <p className="search-page-hint">Tip: type in the site search and press <kbd>Enter</kbd> or <kbd>Return</kbd> anytime to come here.</p>
    </header>

    {query.trim().length >= 2 && results.length > 0 && <>
      <div className="search-page-summary" aria-live="polite">
        <div><strong>{results.length}</strong><span>match{results.length === 1 ? "" : "es"} for “{query.trim()}”</span></div>
        <nav aria-label="Jump to search result section">
          {groups.map((group) => <button type="button" onClick={() => document.getElementById(searchGroupId(group.type))?.scrollIntoView({ behavior: "smooth", block: "start" })} key={group.type}><b>{group.results.length}</b>{SEARCH_GROUP_LABELS[group.type]}</button>)}
        </nav>
      </div>

      <div className="search-page-results">
        {groups.map((group) => <section className="search-page-group paper-stack" id={searchGroupId(group.type)} key={group.type}>
          <header><div><span className="eyebrow">Filed under</span><h2>{SEARCH_GROUP_LABELS[group.type]}</h2></div><strong>{group.results.length}</strong></header>
          <div className="search-page-result-grid">
            {group.results.map((result) => <button type="button" className="search-page-result" onClick={() => openResult(result)} key={`${result.type}-${result.title}-${result.detail}`}>
              <span>{result.type}</span>
              <h3>{result.title}</h3>
              <p>{result.detail}</p>
              <b>Open filing →</b>
            </button>)}
          </div>
        </section>)}
      </div>
    </>}

    {query.trim().length < 2 && <section className="search-page-empty paper-stack"><span aria-hidden="true">⌕</span><h2>Give me at least two characters.</h2><p>Then I’ll search the whole dojo instead of making the filing cabinet panic.</p></section>}
    {query.trim().length >= 2 && results.length === 0 && <section className="search-page-empty paper-stack"><span aria-hidden="true">?</span><h2>No matching filing survived that search.</h2><p>Try a shorter term, a card name, a rules phrase, or a catalog ID.</p></section>}
  </main>;
}
