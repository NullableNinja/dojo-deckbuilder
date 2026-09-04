from pathlib import Path
import re

APP = Path("app/companion-app.tsx")
CSS = Path("app/globals.css")
TEST = Path("tests/companion-smart-tools.test.mjs")

app = APP.read_text()
css = CSS.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)


app = replace_once(
    app,
    'import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
    'import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";',
    "React keyboard event import",
)
app = replace_once(
    app,
    'import rulesJson from "./data/rules.json";',
    'import rulesJson from "./data/rules.json";\nimport gameDefinitionJson from "./data/game-definition.json";',
    "game definition import",
)

app = replace_once(
    app,
    'const rulesData = rulesJson as { version: string; chapters: RuleChapter[]; officialRulings: OfficialRuling[]; glossary: { term: string; meaning: string }[]; houseRules: HouseRule[] };',
    '''const rulesData = rulesJson as { version: string; chapters: RuleChapter[]; officialRulings: OfficialRuling[]; glossary: { term: string; meaning: string }[]; houseRules: HouseRule[] };
const gameDefinition = gameDefinitionJson as { rulesVersion: string; rulesRevision: string };
const CURRENT_RULES_REVISION = gameDefinition.rulesRevision;
const BINDER_STORAGE_KEY = "dojo-binder-v1";
const RULES_SEEN_STORAGE_KEY = "dojo-rules-seen-revision";
const RULES_REVISION_NOTES = [
  "Yell no longer has a two-Attack cap: play any number of legal Attacks from your hand and resolve each separately.",
  "Defense Practice is once per Yell and grants only that Defense card’s printed Focus—no Guard, rules text, or Defense XP.",
  "The Market now refills immediately after each purchase by revealing the top card for the empty slot.",
  "Quick Duel uses fixed 25 HP while keeping the normal Belt perks and rewards active.",
];
const SEARCH_GROUP_ORDER: GlobalResult["type"][] = ["Card", "Rule", "Glossary", "Ruling", "House Rule"];
const SEARCH_GROUP_LABELS: Record<GlobalResult["type"], string> = { Card: "Cards", Rule: "Rules", Glossary: "Glossary", Ruling: "Rulings", "House Rule": "House Rules" };
const readStoredStringSet = (key: string) => {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
};''',
    "smart companion constants",
)

app = replace_once(
    app,
    'const cardSearchText = (card: CardEntry) => [card.catalogId, card.name, card.cardType, card.subtype, card.category, card.deck, card.lineage, card.zone, card.timing, card.rulesText, card.flavorText, ...card.tags, ...card.buildPaths, ...Object.keys(card.stats), ...Object.values(card.stats), ...publicCardDetails(card).flatMap(([key, value]) => [key, value])].filter((value) => value !== null && value !== undefined && value !== "").join(" ").toLocaleLowerCase();',
    '''const cardSearchText = (card: CardEntry) => [card.catalogId, card.name, card.cardType, card.subtype, card.category, card.deck, card.lineage, card.zone, card.timing, card.rulesText, card.flavorText, ...card.tags, ...card.buildPaths, ...Object.keys(card.stats), ...Object.values(card.stats), ...publicCardDetails(card).flatMap(([key, value]) => [key, value])].filter((value) => value !== null && value !== undefined && value !== "").join(" ").toLocaleLowerCase();
const searchResultRank = (result: GlobalResult, term: string) => {
  const title = result.title.toLocaleLowerCase();
  const detail = result.detail.toLocaleLowerCase();
  if (title === term || detail === term || detail.startsWith(`${term} ·`)) return 0;
  if (title.startsWith(term)) return 1;
  if (title.includes(term)) return 2;
  if (detail.startsWith(term)) return 3;
  return 4;
};''',
    "search rank helper",
)

app = replace_once(
    app,
    'function CardTile({ card, onOpen }: { card: CardEntry; onOpen: () => void }) {',
    'function CardTile({ card, onOpen, saved = false }: { card: CardEntry; onOpen: () => void; saved?: boolean }) {',
    "CardTile binder prop",
)
app = replace_once(
    app,
    '  return <button className={`library-card paper-stack interactive-paper type-${card.cardType.toLocaleLowerCase().replaceAll(" ", "-")}`} onClick={onOpen}>\n    <div className="card-topline">',
    '  return <button className={`library-card paper-stack interactive-paper type-${card.cardType.toLocaleLowerCase().replaceAll(" ", "-")}`} onClick={onOpen}>\n    {saved && <span className="binder-star" aria-label="Saved in Dojo Binder" title="Saved in Dojo Binder">★</span>}\n    <div className="card-topline">',
    "CardTile binder star",
)

app = replace_once(
    app,
    '  total,\n  onPrevious,',
    '  total,\n  saved,\n  onToggleSaved,\n  onPrevious,',
    "CardModal binder destructuring",
)
app = replace_once(
    app,
    '  total: number;\n  onPrevious: () => void;',
    '  total: number;\n  saved: boolean;\n  onToggleSaved: () => void;\n  onPrevious: () => void;',
    "CardModal binder types",
)
app = replace_once(
    app,
    '<div className="modal-badges">',
    '<button type="button" className={`binder-toggle binder-toggle--modal${saved ? " is-saved" : ""}`} aria-pressed={saved} onClick={onToggleSaved}>{saved ? "★ In Dojo Binder" : "☆ Save to Dojo Binder"}</button><div className="modal-badges">',
    "CardModal binder button",
)

app = replace_once(
    app,
    '  const [sort, setSort] = useState("catalog"); const [visible, setVisible] = useState(24); const [selectedCard, setSelectedCard] = useState<CardEntry | null>(null);\n  const activeCard = selectedCard ?? initialCard;',
    '''  const [sort, setSort] = useState("catalog"); const [visible, setVisible] = useState(24); const [selectedCard, setSelectedCard] = useState<CardEntry | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => readStoredStringSet(BINDER_STORAGE_KEY));
  const [binderOnly, setBinderOnly] = useState(false);
  const activeCard = selectedCard ?? initialCard;
  useEffect(() => {
    window.localStorage.setItem(BINDER_STORAGE_KEY, JSON.stringify([...savedIds]));
  }, [savedIds]);
  const toggleSaved = (card: CardEntry) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(card.catalogId)) next.delete(card.catalogId); else next.add(card.catalogId);
      return next;
    });
    if (binderOnly && savedIds.has(card.catalogId)) setBinderOnly(false);
  };''',
    "CardsView binder state",
)
app = replace_once(
    app,
    '  const typedCards = useMemo(() => cardsInScope.filter((card) => type === "All" || card.cardType === type), [cardsInScope, type]);',
    '  const typedCards = useMemo(() => cardsInScope.filter((card) => (type === "All" || card.cardType === type) && (!binderOnly || savedIds.has(card.catalogId))), [cardsInScope, type, binderOnly, savedIds]);',
    "Binder-only filtering",
)
app = replace_once(
    app,
    '  const resetFilters = () => { setQuery(""); setType("All"); setDeck("All"); resetSecondaryFilters(); setVisible(24); };',
    '  const resetFilters = () => { setQuery(""); setType("All"); setDeck("All"); resetSecondaryFilters(); setBinderOnly(false); setVisible(24); };',
    "Binder reset",
)
app = replace_once(
    app,
    '            <section className="library-controls"><div className="library-control library-search-control">',
    '            <section className="library-controls"><div className="library-control library-search-control">',
    "Cards controls anchor",
)
app = replace_once(
    app,
    '</select></label></section>\n    <div className="type-filters" role="group" aria-label="Filter by card type">',
    '''</select></label></section>
    <div className="binder-strip"><button type="button" className={`binder-toggle${binderOnly ? " is-saved" : ""}`} aria-pressed={binderOnly} onClick={() => { setBinderOnly((current) => !current); setVisible(24); }}><span aria-hidden="true">{binderOnly ? "★" : "☆"}</span> Dojo Binder <b>{savedIds.size}</b></button><p>Saved on this device only. Open a card to add or remove it.</p></div>
    <div className="type-filters" role="group" aria-label="Filter by card type">''',
    "Binder strip",
)
app = replace_once(
    app,
    '<CardTile key={card.id} card={card} onOpen={() => openCard(card)} />',
    '<CardTile key={card.id} card={card} saved={savedIds.has(card.catalogId)} onOpen={() => openCard(card)} />',
    "CardTile saved mapping",
)
app = replace_once(
    app,
    '<CardModal card={activeCard} previousCard={previousCard} nextCard={nextCard} position={activeIndex + 1} total={filtered.length} onPrevious={() => stepCard(previousCard)} onNext={() => stepCard(nextCard)} onClose={closeCard} />',
    '<CardModal card={activeCard} previousCard={previousCard} nextCard={nextCard} position={Math.max(1, activeIndex + 1)} total={filtered.length} saved={savedIds.has(activeCard.catalogId)} onToggleSaved={() => toggleSaved(activeCard)} onPrevious={() => stepCard(previousCard)} onNext={() => stepCard(nextCard)} onClose={closeCard} />',
    "CardModal binder wiring",
)

app = replace_once(
    app,
    '  const [globalSearch, setGlobalSearch] = useState(""); const [searchedCard, setSearchedCard] = useState<CardEntry | null>(null); const [searchedTerm, setSearchedTerm] = useState("");',
    '''  const [globalSearch, setGlobalSearch] = useState(""); const [globalSelection, setGlobalSelection] = useState(0); const [searchedCard, setSearchedCard] = useState<CardEntry | null>(null); const [searchedTerm, setSearchedTerm] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [rulesUpdateAvailable, setRulesUpdateAvailable] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(RULES_SEEN_STORAGE_KEY) !== CURRENT_RULES_REVISION);''',
    "global search selection and revision state",
)

start = app.index('  const globalResults: GlobalResult[] = useMemo(() => {')
end = app.index('  const chooseResult = (result: GlobalResult) => {', start)
new_search_block = '''  const globalResults: GlobalResult[] = useMemo(() => {
    const term = globalSearch.trim().toLocaleLowerCase(); if (term.length < 2) return [];
    const rules: GlobalResult[] = ruleChapters.flatMap((chapter): GlobalResult[] => {
      if (!JSON.stringify(chapter).toLocaleLowerCase().includes(term)) return [];
      const section = chapter.sections.find((entry) => JSON.stringify(entry).toLocaleLowerCase().includes(term));
      return [{ type: "Rule", title: chapter.title, detail: section ? `Chapter ${displayRuleNumber(chapter)} · ${section.title}` : `Chapter ${displayRuleNumber(chapter)} · overview`, view: "rules", chapterId: chapter.id, sectionId: section?.id }];
    }).slice(0, 4);
    const rulings: GlobalResult[] = OFFICIAL_RULINGS.filter((entry) => Object.values(entry).join(" ").toLocaleLowerCase().includes(term)).slice(0, 3).map(({ id, filed, tag, title }) => ({ type: "Ruling", title, detail: `${id} · ${tag} · ${filed}`, view: "rulings", query: id }));
    const cards: GlobalResult[] = cardData.cards.filter((card) => cardSearchText(card).includes(term)).slice(0, 5).map((card) => ({ type: "Card", title: card.name, detail: `${card.catalogId} · ${card.cardType} · ${card.subtype}`, view: "cards", card }));
    const terms: GlobalResult[] = GLOSSARY_ENTRIES.filter((entry) => `${entry.term} ${entry.meaning}`.toLocaleLowerCase().includes(term)).slice(0, 3).map((entry) => ({ type: "Glossary", title: entry.term, detail: entry.meaning, view: "glossary", query: entry.term }));
    const houseRules: GlobalResult[] = rulesData.houseRules.filter((entry) => `${entry.name} ${entry.rule} ${entry.summary ?? ""} ${entry.notes ?? ""}`.toLocaleLowerCase().includes(term)).slice(0, 3).map((entry) => ({ type: "House Rule", title: entry.name, detail: entry.summary || entry.rule, view: "house-rules", query: entry.name }));
    return [...rules, ...rulings, ...cards, ...terms, ...houseRules]
      .sort((a, b) => searchResultRank(a, term) - searchResultRank(b, term) || SEARCH_GROUP_ORDER.indexOf(a.type) - SEARCH_GROUP_ORDER.indexOf(b.type) || a.title.localeCompare(b.title))
      .slice(0, 14);
  }, [globalSearch]);
  const groupedGlobalResults = useMemo(() => {
    const term = globalSearch.trim().toLocaleLowerCase();
    return SEARCH_GROUP_ORDER.map((type) => ({ type, results: globalResults.filter((result) => result.type === type) }))
      .filter((group) => group.results.length)
      .sort((a, b) => searchResultRank(a.results[0], term) - searchResultRank(b.results[0], term) || SEARCH_GROUP_ORDER.indexOf(a.type) - SEARCH_GROUP_ORDER.indexOf(b.type));
  }, [globalResults, globalSearch]);
  const orderedGlobalResults = useMemo(() => groupedGlobalResults.flatMap((group) => group.results), [groupedGlobalResults]);
  useEffect(() => setGlobalSelection(0), [globalSearch]);
'''
app = app[:start] + new_search_block + app[end:]

anchor = '  const moreActive = view === "story" || view === "rulings" || view === "glossary" || view === "house-rules";'
if anchor not in app:
    raise RuntimeError("Missing result-helper anchor")
helpers = '''  const handleGlobalSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setGlobalSearch("");
      event.currentTarget.blur();
      return;
    }
    if (!orderedGlobalResults.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setGlobalSelection((current) => (current + direction + orderedGlobalResults.length) % orderedGlobalResults.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const result = orderedGlobalResults[Math.min(globalSelection, orderedGlobalResults.length - 1)];
      if (result) chooseResult(result);
    }
  };
  const acknowledgeRulesRevision = () => {
    window.localStorage.setItem(RULES_SEEN_STORAGE_KEY, CURRENT_RULES_REVISION);
    setRulesUpdateAvailable(false);
    setShowRevision(false);
  };
  const renderGlobalResults = (className: string, id: string) => <div className={className} id={id} role="listbox" aria-label="Dojo search results">{groupedGlobalResults.map((group) => <section className="global-result-group" key={group.type}><strong>{SEARCH_GROUP_LABELS[group.type]}</strong>{group.results.map((result) => { const index = orderedGlobalResults.indexOf(result); return <button type="button" role="option" aria-selected={index === globalSelection} className={index === globalSelection ? "is-selected" : ""} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setGlobalSelection(index)} onClick={() => chooseResult(result)} key={`${result.type}-${result.title}-${result.detail}`}><span>{result.type}</span><b>{result.title}</b><small>{result.detail}</small></button>; })}</section>)}</div>;
'''
app = app.replace(anchor, helpers + anchor, 1)

app = app.replace(
    'onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search the dojo"',
    'onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={handleGlobalSearchKeyDown} placeholder="Search the dojo"',
)
if app.count('onKeyDown={handleGlobalSearchKeyDown}') < 2:
    raise RuntimeError("Expected desktop and mobile global search keyboard handlers")

pattern = re.compile(r'\{globalResults\.length > 0 && <div className="global-results">\{globalResults\.map\(\(result, index\) => <button.*?</div>\}', re.DOTALL)
app, count = pattern.subn('{globalResults.length > 0 && renderGlobalResults("global-results", "dojo-global-results")}', app, count=1)
if count != 1:
    raise RuntimeError("Could not replace desktop global results")

mobile_old = '{globalSearch.trim().length >= 2 && <div className="mobile-search-results">{globalResults.length ? globalResults.map((result, index) => <button onClick={() => chooseResult(result)} key={`${result.type}-${result.title}-${index}`}><span>{result.type}</span><b>{result.title}</b><small>{result.detail}</small></button>) : <p>No matching filing number. Try a shorter search.</p>}</div>}'
mobile_new = '{globalSearch.trim().length >= 2 && (globalResults.length ? renderGlobalResults("mobile-search-results", "dojo-mobile-search-results") : <div className="mobile-search-results"><p>No matching filing number. Try a shorter search.</p></div>)}'
app = replace_once(app, mobile_old, mobile_new, "mobile grouped results")

app = replace_once(
    app,
    '</div><ThemeToggle theme={theme} onToggle={toggleTheme} />',
    '</div>{rulesUpdateAvailable && <button type="button" className="rules-update-pill" onClick={() => setShowRevision(true)} title={`Review ${CURRENT_RULES_REVISION}`}><b>NEW</b><span>{CURRENT_RULES_REVISION}</span></button>}<ThemeToggle theme={theme} onToggle={toggleTheme} />',
    "desktop rules update pill",
)
app = replace_once(
    app,
    '<nav className="mobile-menu-links" aria-label="All site pages">',
    '{rulesUpdateAvailable && <button type="button" className="mobile-rules-update" onClick={() => setShowRevision(true)}><b>New rules filing</b><span>{CURRENT_RULES_REVISION} · See what changed →</span></button>}<nav className="mobile-menu-links" aria-label="All site pages">',
    "mobile rules update pill",
)
app = replace_once(
    app,
    '    {scrollProgress > .2 && <button className="back-to-top"',
    '''    {showRevision && <DetailModal eyebrow="New Department Filing" title={`${CURRENT_RULES_REVISION} is now current`} onClose={() => setShowRevision(false)} accent="gold"><p className="modal-lede">This browser has not marked the current rules revision as reviewed yet. Here are the changes most likely to matter at the table.</p><ul className="revision-notes">{RULES_REVISION_NOTES.map((note) => <li key={note}>{note}</li>)}</ul><div className="revision-actions"><button className="button primary" type="button" onClick={() => { acknowledgeRulesRevision(); goTo("rules"); }}>Review full rules →</button><button className="button ghost" type="button" onClick={acknowledgeRulesRevision}>Mark reviewed</button></div></DetailModal>}
    {scrollProgress > .2 && <button className="back-to-top"''',
    "rules revision modal",
)

css_addition = r'''

/* Smart companion tools: grouped search, revision filing, and local Dojo Binder. */
.global-result-group { border-bottom: 1px solid var(--line); }
.global-result-group:last-child { border-bottom: 0; }
.global-result-group > strong {
  display: block;
  padding: 8px 14px 6px;
  color: #7a6650;
  background: #eadbbd;
  font-size: 8px;
  font-weight: 950;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.global-results .global-result-group button.is-selected,
.global-results .global-result-group button:hover,
.mobile-search-results .global-result-group button.is-selected {
  padding-left: 21px;
  background: #f0e3c6;
  box-shadow: inset 4px 0 0 var(--red);
}
.global-result-group button[aria-selected="true"] { outline: none; }

.rules-update-pill {
  min-width: 78px;
  height: 38px;
  display: grid;
  align-content: center;
  gap: 1px;
  border: 1px solid rgba(255,218,112,.38);
  border-radius: 9px 4px 10px 5px;
  padding: 4px 8px;
  color: #fff2c7;
  background: rgba(219,163,39,.12);
  cursor: pointer;
}
.rules-update-pill b { color: #ffd56a; font-size: 7px; letter-spacing: .14em; }
.rules-update-pill span { font-size: 8px; font-weight: 900; white-space: nowrap; }
.rules-update-pill:hover { background: rgba(219,163,39,.22); }
.mobile-rules-update {
  width: 100%;
  display: grid;
  gap: 4px;
  border: 1px solid rgba(255,213,106,.28);
  border-left: 5px solid var(--gold);
  padding: 13px 14px;
  color: #fff5d8;
  text-align: left;
  background: rgba(255,213,106,.08);
  cursor: pointer;
}
.mobile-rules-update b { font-family: var(--display); font-size: 17px; }
.mobile-rules-update span { color: #dbcda8; font-size: 10px; }
.revision-notes { display: grid; gap: 9px; margin: 22px 0; padding: 0; list-style: none; }
.revision-notes li { border-left: 5px solid var(--gold); padding: 10px 13px; background: rgba(255,250,240,.5); line-height: 1.55; }
.revision-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 22px; }

.binder-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: -4px 0 16px;
  border: 1px dashed #b49e72;
  border-radius: 8px 3px 9px 4px;
  padding: 10px 12px;
  background: rgba(255,246,219,.42);
}
.binder-strip p { margin: 0; color: #6c756e; font-size: 10px; }
.binder-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #ad9568;
  border-radius: 999px;
  padding: 8px 11px;
  color: #69542c;
  background: #fff4cf;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
}
.binder-toggle b { min-width: 20px; border-radius: 999px; padding: 2px 5px; color: #fff; background: #86682c; font-size: 8px; text-align: center; }
.binder-toggle.is-saved { border-color: #b3871e; color: #563f0d; background: #f6d874; box-shadow: 2px 3px 0 rgba(117,83,16,.18); }
.binder-toggle--modal { margin: 18px 0 0; }
.binder-star {
  position: absolute;
  z-index: 5;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid #b58724;
  border-radius: 50%;
  color: #63480d;
  background: #f7d96f;
  box-shadow: 2px 3px 0 rgba(70,52,14,.2);
  font-size: 15px;
  pointer-events: none;
}

:root[data-theme="dark"] .global-result-group > strong { color: #e0c98d; background: #26382e; }
:root[data-theme="dark"] .global-results .global-result-group button.is-selected,
:root[data-theme="dark"] .global-results .global-result-group button:hover,
:root[data-theme="dark"] .mobile-search-results .global-result-group button.is-selected { background: #2c4034; }
:root[data-theme="dark"] .revision-notes li { color: #e1ece4; background: #24342a; }
:root[data-theme="dark"] .binder-strip { border-color: #665b3e; background: rgba(95,77,34,.14); }
:root[data-theme="dark"] .binder-strip p { color: #b8c8bc; }
:root[data-theme="dark"] .binder-toggle { border-color: #75673f; color: #f0deb0; background: #3c3827; }
:root[data-theme="dark"] .binder-toggle.is-saved { border-color: #c59c35; color: #fff0bc; background: #594b22; }

@media (max-width: 1180px) {
  .rules-update-pill span { display: none; }
  .rules-update-pill { min-width: 42px; }
}
@media (max-width: 840px) {
  .binder-strip { align-items: flex-start; flex-direction: column; }
  .binder-strip p { line-height: 1.45; }
  .revision-actions .button { width: 100%; }
}
'''
if "Smart companion tools: grouped search" not in css:
    css += css_addition

TEST.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("global search is grouped, ranked, and keyboard navigable", () => {
  assert.match(source, /searchResultRank/);
  assert.match(source, /groupedGlobalResults/);
  assert.match(source, /handleGlobalSearchKeyDown/);
  assert.match(source, /event\.key === "ArrowDown"/);
  assert.match(source, /role="listbox"/);
  assert.match(css, /global-result-group/);
});

test("rules revision filing is driven by canonical game definition", () => {
  assert.match(source, /gameDefinitionJson/);
  assert.match(source, /CURRENT_RULES_REVISION/);
  assert.match(source, /RULES_SEEN_STORAGE_KEY/);
  assert.match(source, /rules-update-pill/);
  assert.match(source, /RULES_REVISION_NOTES/);
});

test("Dojo Binder stores card IDs locally and supports binder-only filtering", () => {
  assert.match(source, /BINDER_STORAGE_KEY/);
  assert.match(source, /readStoredStringSet/);
  assert.match(source, /savedIds/);
  assert.match(source, /binderOnly/);
  assert.match(source, /Save to Dojo Binder/);
  assert.match(css, /binder-strip/);
  assert.match(css, /binder-star/);
});

test("Quick Duel remains statically imported after companion enhancements", () => {
  assert.match(source, /import PlaytestView from "\.\/playtest"/);
  assert.doesNotMatch(source, /const PlaytestView = lazy/);
});
''')

APP.write_text(app)
CSS.write_text(css)
print("Smart companion patch applied")
