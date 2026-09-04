from pathlib import Path

app_path = Path("app/companion-app.tsx")
app = app_path.read_text()

replacements = [
    (
        'type GlobalResult = { type: "Card" | "Glossary" | "Rule" | "Ruling" | "House Rule"; title: string; detail: string; view: ViewId; card?: CardEntry | null; query?: string; chapterId?: string };',
        'type GlobalResult = { type: "Card" | "Glossary" | "Rule" | "Ruling" | "House Rule"; title: string; detail: string; view: ViewId; card?: CardEntry | null; query?: string; chapterId?: string; sectionId?: string };',
    ),
    (
        'const ALL_VIEWS: ViewId[] = ["home", ...NAV_ITEMS.map((item) => item.id)];',
        '''const ALL_VIEWS: ViewId[] = ["home", ...NAV_ITEMS.map((item) => item.id)];
const decodeHashPart = (value = "") => { try { return decodeURIComponent(value); } catch { return value; } };
const dojoHash = (view: ViewId, detail?: string, subdetail?: string) => `#${[view, detail, subdetail].filter((part): part is string => Boolean(part)).map((part, index) => index === 0 ? part : encodeURIComponent(part)).join("/")}`;
const parseDojoHash = () => {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return { view: "home" as ViewId, detail: "", subdetail: "" };
  const [rawView, rawDetail = "", rawSubdetail = ""] = raw.split("/");
  const view = ALL_VIEWS.includes(rawView as ViewId) ? rawView as ViewId : "home";
  return { view, detail: decodeHashPart(rawDetail), subdetail: decodeHashPart(rawSubdetail) };
};''',
    ),
    (
        'function RulesView({ initialChapterId = "" }: { initialChapterId?: string }) {',
        'function RulesView({ initialChapterId = "", initialSectionId = "" }: { initialChapterId?: string; initialSectionId?: string }) {',
    ),
    (
        '  const selectedVisual = RULE_VISUALS[selected.number];',
        '''  const selectedVisual = RULE_VISUALS[selected.number];
  useEffect(() => {
    if (!initialSectionId || query) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(initialSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [initialSectionId, query, selected.id]);''',
    ),
    (
        '''  const chooseChapter = (id: string) => {
    setSelectedId(id);
    setQuery("");
    window.requestAnimationFrame(() => document.getElementById("rule-reader")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };''',
        '''  const chooseChapter = (id: string) => {
    setSelectedId(id);
    setQuery("");
    window.history.pushState(null, "", dojoHash("rules", id));
    window.requestAnimationFrame(() => document.getElementById("rule-reader")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const chooseSection = (id: string) => {
    window.history.pushState(null, "", dojoHash("rules", selected.id, id));
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };''',
    ),
    (
        '<div className="chapter-art"><img src={selectedVisual.art} alt={selectedVisual.alt} loading="lazy" decoding="async" /><div><span>{selectedVisual.label}</span><p>{selectedVisual.quip}</p></div></div><RuleBlocks blocks={selected.intro} />',
        '<div className="chapter-art"><img src={selectedVisual.art} alt={selectedVisual.alt} loading="lazy" decoding="async" /><div><span>{selectedVisual.label}</span><p>{selectedVisual.quip}</p></div></div><nav className="rule-section-nav" aria-label={`${selected.title} sections`}><span>In this chapter</span>{selected.sections.map((section) => <button type="button" onClick={() => chooseSection(section.id)} key={section.id}>{section.title}</button>)}</nav><RuleBlocks blocks={selected.intro} />',
    ),
    (
        '  const activeCard = selectedCard ?? initialCard;',
        '''  const activeCard = selectedCard ?? initialCard;
  useEffect(() => { setSelectedCard(initialCard ?? null); }, [initialCard]);
  const openCard = (card: CardEntry) => { setSelectedCard(card); window.history.pushState(null, "", dojoHash("cards", card.catalogId)); };
  const stepCard = (card: CardEntry | null) => { if (!card) return; setSelectedCard(card); window.history.replaceState(null, "", dojoHash("cards", card.catalogId)); };
  const closeCard = () => { setSelectedCard(null); clearInitialCard(); window.history.replaceState(null, "", dojoHash("cards")); };''',
    ),
    (
        '<CardTile key={card.id} card={card} onOpen={() => setSelectedCard(card)} />',
        '<CardTile key={card.id} card={card} onOpen={() => openCard(card)} />',
    ),
    (
        '<CardModal card={activeCard} previousCard={previousCard} nextCard={nextCard} position={activeIndex + 1} total={filtered.length} onPrevious={() => previousCard && setSelectedCard(previousCard)} onNext={() => nextCard && setSelectedCard(nextCard)} onClose={() => { setSelectedCard(null); clearInitialCard(); }} />',
        '<CardModal card={activeCard} previousCard={previousCard} nextCard={nextCard} position={activeIndex + 1} total={filtered.length} onPrevious={() => stepCard(previousCard)} onNext={() => stepCard(nextCard)} onClose={closeCard} />',
    ),
    (
        '  const [searchedRuleChapter, setSearchedRuleChapter] = useState(""); const [searchedRuling, setSearchedRuling] = useState(""); const [searchedHouseRule, setSearchedHouseRule] = useState("");',
        '  const [searchedRuleChapter, setSearchedRuleChapter] = useState(""); const [searchedRuleSection, setSearchedRuleSection] = useState(""); const [searchedRuling, setSearchedRuling] = useState(""); const [searchedHouseRule, setSearchedHouseRule] = useState("");',
    ),
    (
        '''  useEffect(() => {
    const sync = () => { const next = window.location.hash.replace("#", "") as ViewId; if (ALL_VIEWS.includes(next)) setView(next); };
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, []);''',
        '''  useEffect(() => {
    const sync = () => {
      const route = parseDojoHash();
      setView(route.view);
      setSearchedCard(route.view === "cards" && route.detail ? cardData.cards.find((card) => card.catalogId.toLocaleLowerCase() === route.detail.toLocaleLowerCase()) ?? null : null);
      setSearchedTerm(route.view === "glossary" ? route.detail : "");
      setSearchedRuleChapter(route.view === "rules" ? route.detail : "");
      setSearchedRuleSection(route.view === "rules" ? route.subdetail : "");
      setSearchedRuling(route.view === "rulings" ? route.detail : "");
      setSearchedHouseRule(route.view === "house-rules" ? route.detail : "");
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync); };
  }, []);''',
    ),
    (
        '  const goTo = (next: ViewId) => { setSearchedCard(null); setSearchedTerm(""); setSearchedRuleChapter(""); setSearchedRuling(""); setSearchedHouseRule(""); setView(next); setMenuOpen(false); setGlobalSearch(""); window.history.pushState(null, "", `#${next}`); window.scrollTo({ top: 0, behavior: "smooth" }); };',
        '  const goTo = (next: ViewId) => { setSearchedCard(null); setSearchedTerm(""); setSearchedRuleChapter(""); setSearchedRuleSection(""); setSearchedRuling(""); setSearchedHouseRule(""); setView(next); setMenuOpen(false); setGlobalSearch(""); window.history.pushState(null, "", dojoHash(next)); window.scrollTo({ top: 0, behavior: "smooth" }); };',
    ),
    (
        'return [{ type: "Rule", title: chapter.title, detail: section ? `Chapter ${displayRuleNumber(chapter)} · ${section.title}` : `Chapter ${displayRuleNumber(chapter)} · overview`, view: "rules", chapterId: chapter.id }];',
        'return [{ type: "Rule", title: chapter.title, detail: section ? `Chapter ${displayRuleNumber(chapter)} · ${section.title}` : `Chapter ${displayRuleNumber(chapter)} · overview`, view: "rules", chapterId: chapter.id, sectionId: section?.id }];',
    ),
    (
        '({ id, filed, tag, title }) => ({ type: "Ruling", title, detail: `${id} · ${tag} · ${filed}`, view: "rulings", query: title })',
        '({ id, filed, tag, title }) => ({ type: "Ruling", title, detail: `${id} · ${tag} · ${filed}`, view: "rulings", query: id })',
    ),
    (
        '''  const chooseResult = (result: GlobalResult) => {
    goTo(result.view);
    if (result.card) setSearchedCard(result.card);
    if (result.view === "glossary") setSearchedTerm(result.query ?? result.title);
    if (result.view === "rules") setSearchedRuleChapter(result.chapterId ?? "");
    if (result.view === "rulings") setSearchedRuling(result.query ?? result.title);
    if (result.view === "house-rules") setSearchedHouseRule(result.query ?? result.title);
  };''',
        '''  const chooseResult = (result: GlobalResult) => {
    goTo(result.view);
    if (result.card) { setSearchedCard(result.card); window.history.replaceState(null, "", dojoHash("cards", result.card.catalogId)); }
    if (result.view === "glossary") { const target = result.query ?? result.title; setSearchedTerm(target); window.history.replaceState(null, "", dojoHash("glossary", target)); }
    if (result.view === "rules") { setSearchedRuleChapter(result.chapterId ?? ""); setSearchedRuleSection(result.sectionId ?? ""); window.history.replaceState(null, "", dojoHash("rules", result.chapterId, result.sectionId)); }
    if (result.view === "rulings") { const target = result.query ?? result.title; setSearchedRuling(target); window.history.replaceState(null, "", dojoHash("rulings", target)); }
    if (result.view === "house-rules") { const target = result.query ?? result.title; setSearchedHouseRule(target); window.history.replaceState(null, "", dojoHash("house-rules", target)); }
  };''',
    ),
    (
        '<RulesView key={searchedRuleChapter || "rules"} initialChapterId={searchedRuleChapter} />',
        '<RulesView key={`${searchedRuleChapter || "rules"}-${searchedRuleSection}`} initialChapterId={searchedRuleChapter} initialSectionId={searchedRuleSection} />',
    ),
]

for old, new in replacements:
    if old not in app:
        raise SystemExit(f"Missing expected deep-link fragment: {old[:140]}")
    app = app.replace(old, new, 1)

app_path.write_text(app)

css_path = Path("app/globals.css")
css = css_path.read_text()
addition = '''

/* Shareable rule-section navigation. */
.rule-section-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 18px 0 24px;
  padding: 14px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--paper-light) 74%, transparent);
}
.rule-section-nav > span {
  flex: 0 0 100%;
  color: var(--ink-soft);
  font-family: var(--display);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.rule-section-nav button {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 7px 10px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.rule-section-nav button:hover,
.rule-section-nav button:focus-visible { border-color: var(--red); color: var(--red-dark); }
:root[data-theme="dark"] .rule-section-nav { background: rgba(31,48,39,.62); }
@media (max-width: 840px) { .rule-section-nav { margin-inline: -4px; } }
'''
if "Shareable rule-section navigation" not in css:
    css += addition
css_path.write_text(css)

Path("tests/deep-links.test.mjs").write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("companion supports shareable deep links for rules and cards", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /const dojoHash =/);
  assert.match(source, /const parseDojoHash =/);
  assert.match(source, /dojoHash\("cards", card\.catalogId\)/);
  assert.match(source, /dojoHash\("rules", selected\.id, id\)/);
  assert.match(source, /initialSectionId/);
  assert.match(source, /className="rule-section-nav"/);
  assert.match(css, /Shareable rule-section navigation/);
});
''')
