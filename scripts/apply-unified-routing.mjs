import fs from "node:fs";

const companionPath = "app/companion-app.tsx";
const mainPath = "src/main.tsx";
let source = fs.readFileSync(companionPath, "utf8");

const replaceOrThrow = (pattern, replacement, label) => {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Unified routing transform missed: ${label}`);
  source = next;
};

replaceOrThrow(
  'import PlaytestView from "./playtest";\n',
  'import PlaytestView from "./playtest";\nimport SearchPage from "./search-page";\nimport { navigate, readRoute, replaceRoute, subscribeToRoute, topLevelRoute, type RulingsTab, type SitePage, type SiteRoute } from "./routing";\nimport { ALL_GLOSSARY_ENTRIES, SEARCH_GROUP_LABELS, cardSearchText, groupSearchResults, normalizeSearchQuery, publicCardDetails, searchDojo, type CardEntry, type SearchResult } from "./search";\nimport { DESKTOP_NAVIGATION, MOBILE_BOTTOM_NAVIGATION, MOBILE_MENU_NAVIGATION, navigationItemIsActive } from "./site-navigation";\n',
  "shared architecture imports",
);

replaceOrThrow(
  /type ViewId = "home"[\s\S]*?type RuleBlock =/,
  'type ViewId = Exclude<SitePage, "search">;\ntype RuleBlock =',
  "local view/card types",
);
replaceOrThrow(/type RulingsTab = "official" \| "house";\n/, "", "local rulings tab type");
replaceOrThrow(/type GlobalResult = \{[^\n]+\};\n/, "", "legacy global result type");
replaceOrThrow(/const SEARCH_GROUP_ORDER:[^\n]+\nconst SEARCH_GROUP_LABELS:[^\n]+\n/, "", "duplicate search constants");

replaceOrThrow(
  /const glossaryKey =[\s\S]*?const GLOSSARY_ENTRIES =[^\n]+\n/,
  "const GLOSSARY_ENTRIES = ALL_GLOSSARY_ENTRIES;\n",
  "duplicate glossary normalization",
);
replaceOrThrow(
  /const publicCardDetails =[\s\S]*?const searchResultRank =[\s\S]*?\n\};\n\n/,
  "",
  "duplicate card/search helpers",
);

replaceOrThrow(
  /const NAV_ITEMS:[\s\S]*?const parseDojoHash = \(\) => \{[\s\S]*?\n\};\n/,
  `const VIEW_LABELS: Record<SitePage, string> = {
  home: "Dojo Desk",
  playtest: "Field Test",
  quickstart: "Quick Start",
  story: "Backstory",
  rules: "Full Rules",
  cards: "Card Library",
  rulings: "Rulings & Variants",
  glossary: "Glossary",
  search: "Search",
};
`,
  "legacy routing/nav constants",
);

replaceOrThrow(
  'function RulesView({ initialChapterId = "", initialSectionId = "" }: { initialChapterId?: string; initialSectionId?: string }) {\n  const [selectedId, setSelectedId] = useState(() => ruleChapters.some((chapter) => chapter.id === initialChapterId) ? initialChapterId : ruleChapters[0]?.id ?? "");\n  const [query, setQuery] = useState("");',
  'function RulesView({ initialChapterId = "", initialSectionId = "" }: { initialChapterId?: string; initialSectionId?: string }) {\n  const [selectedId, setSelectedId] = useState(() => ruleChapters.some((chapter) => chapter.id === initialChapterId) ? initialChapterId : ruleChapters[0]?.id ?? "");\n  const [query, setQuery] = useState("");\n  useEffect(() => {\n    setSelectedId(ruleChapters.some((chapter) => chapter.id === initialChapterId) ? initialChapterId : ruleChapters[0]?.id ?? "");\n  }, [initialChapterId]);',
  "rules route sync",
);
replaceOrThrow('window.history.pushState(null, "", dojoHash("rules", id));', 'navigate({ page: "rules", chapterId: id });', "rules chapter navigation");
replaceOrThrow('window.history.pushState(null, "", dojoHash("rules", selected.id, id));', 'navigate({ page: "rules", chapterId: selected.id, sectionId: id });', "rules section navigation");

replaceOrThrow(
  'function CardsView({ initialCard, clearInitialCard }: { initialCard: CardEntry | null; clearInitialCard: () => void }) {',
  'function CardsView({ cardId = "" }: { cardId?: string }) {',
  "cards route props",
);
replaceOrThrow(
  '  const [sort, setSort] = useState("catalog"); const [visible, setVisible] = useState(24); const [selectedCard, setSelectedCard] = useState<CardEntry | null>(null);',
  '  const [sort, setSort] = useState("catalog"); const [visible, setVisible] = useState(24);',
  "cards selected local state",
);
replaceOrThrow(
  '  const activeCard = selectedCard ?? initialCard;',
  '  const activeCard = cardId ? cardData.cards.find((card) => card.catalogId.toLocaleLowerCase() === cardId.toLocaleLowerCase()) ?? null : null;',
  "cards route-driven active card",
);
replaceOrThrow(/  useEffect\(\(\) => \{ setSelectedCard\(initialCard \?\? null\); \}, \[initialCard\]\);\n/, "", "cards initial selection effect");
replaceOrThrow(
  '  const openCard = (card: CardEntry) => { setSelectedCard(card); window.history.pushState(null, "", dojoHash("cards", card.catalogId)); };\n  const stepCard = (card: CardEntry | null) => { if (!card) return; setSelectedCard(card); window.history.replaceState(null, "", dojoHash("cards", card.catalogId)); };\n  const closeCard = () => {\n    setSelectedCard(null);\n    clearInitialCard();\n    window.history.replaceState(null, "", dojoHash("cards"));\n  };',
  '  const openCard = (card: CardEntry) => navigate({ page: "cards", cardId: card.catalogId });\n  const stepCard = (card: CardEntry | null) => { if (card) replaceRoute({ page: "cards", cardId: card.catalogId }); };\n  const closeCard = () => replaceRoute({ page: "cards" });',
  "cards navigation functions",
);

replaceOrThrow(
  '    window.history.pushState(null, "", dojoHash("rulings", next));',
  '    navigate({ page: "rulings", tab: next });',
  "rulings tab navigation",
);
replaceOrThrow(
  'function RulingsView({ initialTab = "official", initialQuery = "" }: { initialTab?: RulingsTab; initialQuery?: string }) {\n  const [tab, setTab] = useState<RulingsTab>(initialTab);\n  const [query, setQuery] = useState(initialQuery);\n  const [selected, setSelected] = useState<HouseRule | null>(null);',
  'function RulingsView({ initialTab = "official", initialQuery = "" }: { initialTab?: RulingsTab; initialQuery?: string }) {\n  const [tab, setTab] = useState<RulingsTab>(initialTab);\n  const [query, setQuery] = useState(initialQuery);\n  const [selected, setSelected] = useState<HouseRule | null>(() => initialTab === "house" && initialQuery ? rulesData.houseRules.find((entry) => normalizeSearchQuery(entry.name) === normalizeSearchQuery(initialQuery)) ?? null : null);\n  useEffect(() => {\n    setTab(initialTab);\n    setQuery(initialQuery);\n    setSelected(initialTab === "house" && initialQuery ? rulesData.houseRules.find((entry) => normalizeSearchQuery(entry.name) === normalizeSearchQuery(initialQuery)) ?? null : null);\n  }, [initialTab, initialQuery]);',
  "rulings route sync",
);
replaceOrThrow(
  'onClick={() => setSelected(entry)} key={entry.name}',
  'onClick={() => navigate({ page: "rulings", tab: "house", query: entry.name })} key={entry.name}',
  "house rule route navigation",
);
replaceOrThrow(
  'title={selected.name} onClose={() => setSelected(null)} accent="green"',
  'title={selected.name} onClose={() => replaceRoute({ page: "rulings", tab: "house" })} accent="green"',
  "house rule route close",
);

replaceOrThrow(
  'function GlossaryView({ initialQuery }: { initialQuery: string }) {\n  const [query, setQuery] = useState(initialQuery);\n  const [selected, setSelected] = useState<{ term: string; meaning: string } | null>(null);',
  'function GlossaryView({ initialQuery }: { initialQuery: string }) {\n  const [query, setQuery] = useState(initialQuery);\n  const [selected, setSelected] = useState<{ term: string; meaning: string } | null>(() => initialQuery ? GLOSSARY_ENTRIES.find((entry) => normalizeSearchQuery(entry.term) === normalizeSearchQuery(initialQuery)) ?? null : null);\n  useEffect(() => {\n    setQuery(initialQuery);\n    setSelected(initialQuery ? GLOSSARY_ENTRIES.find((entry) => normalizeSearchQuery(entry.term) === normalizeSearchQuery(initialQuery)) ?? null : null);\n  }, [initialQuery]);',
  "glossary route sync",
);
replaceOrThrow(
  'onClick={() => setSelected(entry)} key={entry.term}',
  'onClick={() => navigate({ page: "glossary", term: entry.term })} key={entry.term}',
  "glossary term route navigation",
);
replaceOrThrow(
  'title={selected.term} onClose={() => setSelected(null)}',
  'title={selected.term} onClose={() => replaceRoute({ page: "glossary" })}',
  "glossary route close",
);

const companionStart = source.indexOf("export default function CompanionApp() {");
if (companionStart < 0) throw new Error("CompanionApp export not found");
source = source.slice(0, companionStart) + `export default function CompanionApp() {
  const [route, setRoute] = useState<SiteRoute>(() => readRoute());
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSelection, setGlobalSelection] = useState(0);
  const [selectionIntent, setSelectionIntent] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [rulesUpdateAvailable, setRulesUpdateAvailable] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(RULES_SEEN_STORAGE_KEY) !== CURRENT_RULES_REVISION);
  const [scrollProgress, setScrollProgress] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const view = route.page;

  useEffect(() => {
    setRoute(readRoute());
    return subscribeToRoute(setRoute);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    const previous = document.body.style.overflow;
    if (window.matchMedia("(max-width: 840px)").matches) document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [menuOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("paper-fu-theme", theme);
  }, [theme]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const available = document.documentElement.scrollHeight - window.innerHeight;
        setScrollProgress(available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [view]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      } else if (!isTyping && event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  const goTo = (next: ViewId) => {
    setMenuOpen(false);
    setGlobalSearch("");
    setSelectionIntent(false);
    navigate(topLevelRoute(next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const globalResults = useMemo(() => searchDojo(globalSearch).slice(0, 14), [globalSearch]);
  const groupedGlobalResults = useMemo(() => groupSearchResults(globalResults), [globalResults]);
  const orderedGlobalResults = useMemo(() => groupedGlobalResults.flatMap((group) => group.results), [groupedGlobalResults]);

  useEffect(() => {
    setGlobalSelection(0);
    setSelectionIntent(false);
  }, [globalSearch]);

  const chooseResult = (result: SearchResult) => {
    setMenuOpen(false);
    setGlobalSearch("");
    setSelectionIntent(false);
    navigate(result.route);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openFullSearch = () => {
    const query = globalSearch.normalize("NFKC").trim().replace(/\\s+/g, " ");
    if (query.length < 2) return;
    setMenuOpen(false);
    setGlobalSearch("");
    setSelectionIntent(false);
    navigate({ page: "search", query });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGlobalSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setGlobalSearch("");
      setSelectionIntent(false);
      event.currentTarget.blur();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!orderedGlobalResults.length) return;
      event.preventDefault();
      setSelectionIntent(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setGlobalSelection((current) => (current + direction + orderedGlobalResults.length) % orderedGlobalResults.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (selectionIntent && orderedGlobalResults.length) {
        const result = orderedGlobalResults[Math.min(globalSelection, orderedGlobalResults.length - 1)];
        if (result) chooseResult(result);
        return;
      }
      openFullSearch();
    }
  };

  const acknowledgeRulesRevision = () => {
    window.localStorage.setItem(RULES_SEEN_STORAGE_KEY, CURRENT_RULES_REVISION);
    setRulesUpdateAvailable(false);
    setShowRevision(false);
  };

  const renderGlobalResults = (className: string, id: string) => <div className={className} id={id} role="listbox" aria-label="Dojo search results">{groupedGlobalResults.map((group) => <section className="global-result-group" key={group.type}><strong>{SEARCH_GROUP_LABELS[group.type]}</strong>{group.results.map((result) => { const index = orderedGlobalResults.indexOf(result); return <button type="button" role="option" aria-selected={selectionIntent && index === globalSelection} className={selectionIntent && index === globalSelection ? "is-selected" : ""} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => { setGlobalSelection(index); setSelectionIntent(true); }} onClick={() => chooseResult(result)} key={\`${result.type}-${result.title}-${result.detail}\`}><span>{SEARCH_GROUP_LABELS[result.type]}</span><b>{result.title}</b><small>{result.detail}</small></button>; })}</section>)}</div>;

  const moreActive = view === "story" || view === "rulings" || view === "search";
  const toggleTheme = () => setTheme((current) => current === "light" ? "dark" : "light");
  const routeKey = view === "rules"
    ? \`rules-${route.page === "rules" ? route.chapterId ?? "" : ""}-${route.page === "rules" ? route.sectionId ?? "" : ""}\`
    : view === "rulings"
      ? \`rulings-${route.page === "rulings" ? route.tab ?? "official" : "official"}-${route.page === "rulings" ? route.query ?? "" : ""}\`
      : view === "glossary"
        ? \`glossary-${route.page === "glossary" ? route.term ?? "" : ""}\`
        : view;

  return <div className="site-frame">
    <header className="site-header"><div className="header-inner shell"><button className="brand" onClick={() => goTo("home")} aria-label="Dojo Deckbuilder home"><BrandMark /><span><b>DOJO</b><em>DECKBUILDER</em></span></button><nav id="primary-navigation" aria-label="Primary navigation">{DESKTOP_NAVIGATION.map((item) => <button aria-current={navigationItemIsActive(item, route) ? "page" : undefined} className={navigationItemIsActive(item, route) ? "active" : ""} onClick={() => goTo(item.page)} key={item.page}>{item.label}</button>)}</nav><div className="header-search-wrap"><label className="header-search"><span>⌕</span><input ref={searchInputRef} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={handleGlobalSearchKeyDown} placeholder="Search the dojo" aria-label="Search cards, rules, rulings, variants, and glossary" /><kbd>Ctrl K</kbd></label>{globalResults.length > 0 && renderGlobalResults("global-results", "dojo-global-results")}</div>{rulesUpdateAvailable && <button type="button" className="rules-update-pill" onClick={() => setShowRevision(true)} title={\`Review ${CURRENT_RULES_REVISION}\`}><b>NEW</b><span>{CURRENT_RULES_REVISION}</span></button>}<ThemeToggle theme={theme} onToggle={toggleTheme} /><button className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-controls="mobile-menu" aria-expanded={menuOpen} aria-label={menuOpen ? "Close site menu" : "Open site menu"}><span /><span /><span /></button></div><div className="reading-progress" role="progressbar" aria-label={\`${VIEW_LABELS[view]} reading progress\`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(scrollProgress * 100)}><span style={{ width: \`${scrollProgress * 100}%\` }} /><b>{VIEW_LABELS[view]}</b></div></header>
    {menuOpen && <><button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close site menu" /><aside className="mobile-menu-panel" id="mobile-menu" aria-label="Site menu"><div className="mobile-menu-heading"><div><span className="eyebrow">Department directory</span><h2>Find your fight.</h2></div><button className="mobile-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close site menu">×</button></div><label className="mobile-global-search"><span aria-hidden="true">⌕</span><input autoFocus value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={handleGlobalSearchKeyDown} placeholder="Search the dojo" aria-label="Search cards, rules, rulings, variants, and glossary" /></label>{globalSearch.trim().length >= 2 && (globalResults.length ? renderGlobalResults("mobile-search-results", "dojo-mobile-search-results") : <div className="mobile-search-results"><p>No matching filing number. Try a shorter search.</p></div>)}{rulesUpdateAvailable && <button type="button" className="mobile-rules-update" onClick={() => setShowRevision(true)}><b>New rules filing</b><span>{CURRENT_RULES_REVISION} · See what changed →</span></button>}<nav className="mobile-menu-links" aria-label="All site pages">{MOBILE_MENU_NAVIGATION.map((item) => <button aria-current={navigationItemIsActive(item, route) ? "page" : undefined} className={navigationItemIsActive(item, route) ? "active" : ""} onClick={() => goTo(item.page)} key={item.page}><span>{item.label}</span><small>{item.description}</small></button>)}</nav><ThemeToggle theme={theme} onToggle={toggleTheme} full /></aside></>}
    <div key={routeKey} className="view-stage">{route.page === "home" && <HomeView goTo={goTo} />}{route.page === "playtest" && <PlaytestView goTo={goTo} />}{route.page === "quickstart" && <QuickStartView goTo={goTo} />}{route.page === "story" && <StoryView goTo={goTo} />}{route.page === "rules" && <RulesView initialChapterId={route.chapterId ?? ""} initialSectionId={route.sectionId ?? ""} />}{route.page === "cards" && <CardsView cardId={route.cardId} />}{route.page === "rulings" && <RulingsView initialTab={route.tab ?? "official"} initialQuery={route.query ?? ""} />}{route.page === "glossary" && <GlossaryView initialQuery={route.term ?? ""} />}{route.page === "search" && <SearchPage query={route.query ?? ""} />}</div>
    <footer className="site-footer"><div className="shell footer-inner"><div className="brand footer-brand"><BrandMark /><span><b>DOJO</b><em>DECKBUILDER</em></span></div><p>Build your deck. Earn your belt. Try not to fold.</p><span>Filed with the Department. Probably correctly.</span></div></footer>
    {showRevision && <DetailModal eyebrow="New Department Filing" title={\`${CURRENT_RULES_REVISION} is now current\`} onClose={() => setShowRevision(false)} accent="gold"><p className="modal-lede">This browser has not marked the current rules revision as reviewed yet. Here are the changes most likely to matter at the table.</p><ul className="revision-notes">{RULES_REVISION_NOTES.map((note) => <li key={note}>{note}</li>)}</ul><div className="revision-actions"><button className="button primary" type="button" onClick={() => { acknowledgeRulesRevision(); goTo("rules"); }}>Review full rules →</button><button className="button ghost" type="button" onClick={acknowledgeRulesRevision}>Mark reviewed</button></div></DetailModal>}
    {scrollProgress > .2 && <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top"><span aria-hidden="true">↑</span><b>Top</b></button>}
    <nav className="mobile-nav" aria-label="Mobile navigation">{MOBILE_BOTTOM_NAVIGATION.map((item) => <button aria-current={navigationItemIsActive(item, route) ? "page" : undefined} className={navigationItemIsActive(item, route) ? "active" : ""} onClick={() => goTo(item.page)} key={item.page}><span aria-hidden="true">{item.mobileBottomIcon}</span>{item.shortLabel}</button>)}<button className={moreActive || menuOpen ? "active" : ""} onClick={() => setMenuOpen((open) => !open)} aria-controls="mobile-menu" aria-expanded={menuOpen}><span aria-hidden="true">☰</span>Menu</button></nav>
  </div>;
}
`;

fs.writeFileSync(companionPath, source);

let main = fs.readFileSync(mainPath, "utf8");
main = main.replace('import CardViewerLifecycle, { prepareCardRouteAlias } from "../app/card-viewer-lifecycle";\n', "");
main = main.replace('import SearchPage from "../app/search-page";\n', "");
main = main.replace('import MobileSitePolish from "../app/mobile-site-polish";\n', "");
main = main.replace(/\/\/ #card\/DDB-[\s\S]*?prepareCardRouteAlias\(\);\n\n/, "");
main = main.replace('      <CompanionApp />\n      <SearchPage />\n      <MobileSitePolish />\n      <CardViewerLifecycle />', '      <CompanionApp />');
fs.writeFileSync(mainPath, main);

fs.rmSync("app/card-viewer-lifecycle.tsx", { force: true });
fs.rmSync("app/mobile-site-polish.tsx", { force: true });
fs.rmSync("scripts/apply-unified-routing.mjs", { force: true });
fs.rmSync(".github/workflows/apply-unified-routing-once.yml", { force: true });
