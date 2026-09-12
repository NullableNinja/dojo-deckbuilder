import { useEffect, useMemo, useState } from "react";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_NOTES,
  SEARCH_GROUP_ORDER,
  groupSearchResults,
  normalizeSearchQuery,
  searchDojo,
  type SearchResult,
  type SearchResultType,
} from "./search";
import { navigate, replaceRoute } from "./routing";
import "./search-page.css";

const SEARCH_GROUP_ICONS: Record<SearchResultType, string> = {
  card: "◇",
  rule: "§",
  glossary: "Aa",
  ruling: "!",
  "house-rule": "⌂",
};

const searchGroupId = (type: SearchResultType) => `search-${type.replace(/\s+/g, "-")}`;
const searchTypeClass = (type: SearchResultType) => type.replace(/\s+/g, "-");

export default function SearchPage({ query = "" }: { query?: string }) {
  const [draftQuery, setDraftQuery] = useState(query);
  const [activeTypes, setActiveTypes] = useState<SearchResultType[]>(SEARCH_GROUP_ORDER);

  useEffect(() => setDraftQuery(query), [query]);

  const normalizedQuery = normalizeSearchQuery(draftQuery);
  const results = useMemo(() => searchDojo(draftQuery), [draftQuery]);
  const typeCounts = useMemo(() => SEARCH_GROUP_ORDER.reduce<Record<SearchResultType, number>>((counts, type) => {
    counts[type] = results.filter((result) => result.type === type).length;
    return counts;
  }, { card: 0, rule: 0, glossary: 0, ruling: 0, "house-rule": 0 }), [results]);
  const filteredResults = useMemo(() => results.filter((result) => activeTypes.includes(result.type)), [activeTypes, results]);
  const groups = useMemo(() => groupSearchResults(filteredResults), [filteredResults]);
  const allFiltersActive = activeTypes.length === SEARCH_GROUP_ORDER.length;

  const updateQuery = (nextQuery: string) => {
    setDraftQuery(nextQuery);
    const trimmed = nextQuery.normalize("NFKC").trim().replace(/\s+/g, " ");
    replaceRoute(trimmed ? { page: "search", query: trimmed } : { page: "search" });
  };

  const toggleType = (type: SearchResultType) => {
    setActiveTypes((current) => current.includes(type)
      ? current.filter((entry) => entry !== type)
      : SEARCH_GROUP_ORDER.filter((entry) => entry === type || current.includes(entry)));
  };

  const openResult = (result: SearchResult) => navigate(result.route);

  return <main className="search-page shell page-shell" aria-labelledby="dojo-search-title">
    <header className="search-page-hero paper-stack">
      <div className="search-page-heading">
        <div>
          <span className="eyebrow">Dojo search desk</span>
          <h1 id="dojo-search-title">Find it. File it. Fight about it.</h1>
          <p>Search the whole dojo from one index: cards, canonical rules, glossary terms, official rulings, and optional variants.</p>
        </div>
        <div className="search-page-paper-art" aria-hidden="true">
          <span className="search-paper search-paper-one">RULES</span>
          <span className="search-paper search-paper-two">CARDS</span>
          <span className="search-paper search-paper-three">?</span>
          <span className="search-paper-clip" />
          <span className="search-paper-stamp">DOJO<br />INDEX</span>
        </div>
      </div>
      <label className="search-page-input" htmlFor="dojo-search-page-input">
        <span>Search everything</span>
        <div><b aria-hidden="true">⌕</b><input id="dojo-search-page-input" autoFocus value={draftQuery} onChange={(event) => updateQuery(event.target.value)} placeholder="Card, rule, term, ruling…" /></div>
      </label>
    </header>

    {normalizedQuery.length < 2 ? <section className="search-page-empty paper-stack" aria-live="polite">
      <span className="eyebrow">Search the filing cabinet</span>
      <h2>Type at least two characters.</h2>
      <p>Try a card name, catalog ID, rules phrase, glossary term, ruling number, or house-rule name.</p>
    </section> : results.length === 0 ? <section className="search-page-empty paper-stack" aria-live="polite">
      <span className="eyebrow">Nothing in the drawer</span>
      <h2>No results for “{draftQuery.trim()}”.</h2>
      <p>Try a shorter phrase, a catalog ID, or a more general rules term.</p>
    </section> : <>
      <aside className="search-page-summary paper-stack" aria-label="Search result filters">
        <div className="search-dashboard-total" aria-live="polite">
          <span>On the desk</span>
          <strong>{filteredResults.length}</strong>
          <small>{filteredResults.length === results.length ? `${results.length} matches` : `of ${results.length} matches`}</small>
        </div>

        <div className="search-dashboard-filter-heading">
          <span>Filter the pile</span>
          <button type="button" className={allFiltersActive ? "active" : ""} onClick={() => setActiveTypes([...SEARCH_GROUP_ORDER])}>All</button>
        </div>

        <div className="search-dashboard-filters">
          {SEARCH_GROUP_ORDER.map((type) => {
            const selected = activeTypes.includes(type);
            return <button
              type="button"
              className={`${searchTypeClass(type)}${selected ? " active" : ""}`}
              aria-pressed={selected}
              onClick={() => toggleType(type)}
              key={type}
            >
              <span aria-hidden="true">{SEARCH_GROUP_ICONS[type]}</span>
              <div><b>{SEARCH_GROUP_LABELS[type]}</b><small>{typeCounts[type]} result{typeCounts[type] === 1 ? "" : "s"}</small></div>
            </button>;
          })}
        </div>
      </aside>

      <section className="search-page-results" aria-label={`Search results for ${draftQuery.trim()}`}>
        <header className="search-results-heading">
          <div><span className="eyebrow">Search results</span><h2>“{draftQuery.trim()}”</h2></div>
          <strong>{filteredResults.length} shown</strong>
        </header>

        {groups.length > 0 ? groups.map((group) => <section className={`search-result-group ${searchTypeClass(group.type)}`} aria-labelledby={searchGroupId(group.type)} key={group.type}>
          <header>
            <div><span aria-hidden="true">{SEARCH_GROUP_ICONS[group.type]}</span><div><h3 id={searchGroupId(group.type)}>{SEARCH_GROUP_LABELS[group.type]}</h3><p>{SEARCH_GROUP_NOTES[group.type]}</p></div></div>
            <strong>{group.results.length}</strong>
          </header>
          <div className="search-result-list">
            {group.results.map((result) => <button type="button" className="search-result-card paper-stack interactive-paper" onClick={() => openResult(result)} key={`${result.type}-${result.title}-${result.detail}`}>
              <span className="search-result-kind">{SEARCH_GROUP_LABELS[result.type]}</span>
              <div><h4>{result.title}</h4><p>{result.detail}</p></div>
              <span className="search-result-open" aria-hidden="true">→</span>
            </button>)}
          </div>
        </section>) : <div className="search-page-empty paper-stack"><h2>No active result categories.</h2><p>Turn a filter back on or choose All.</p></div>}
      </section>
    </>}
  </main>;
}
