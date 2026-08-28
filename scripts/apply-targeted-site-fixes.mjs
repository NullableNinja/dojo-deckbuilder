import { readFile, writeFile } from "node:fs/promises";

const appPath = "app/companion-app.tsx";
const rulesPath = "app/data/rules.json";
const deployPath = ".github/workflows/deploy-pages.yml";
let app = await readFile(appPath, "utf8");

function replaceOnce(before, after, label) {
  if (app.includes(after)) return;
  if (!app.includes(before)) throw new Error(`Could not find ${label}`);
  app = app.replace(before, after);
}

function replaceRegex(pattern, replacement, label) {
  if (!pattern.test(app)) throw new Error(`Could not find ${label}`);
  app = app.replace(pattern, replacement);
}

replaceOnce(
  'import mrBobbyUrl from "./assets/characters/mr-bobby.webp";',
  'import sentryBobbyUrl from "./assets/cards/characters/sentry-bobby.webp";',
  "legacy Mr. Bobby import",
);

replaceOnce(
  'type RuleVisual = { label: string; quip: string; art: string; alt: string };',
  'type RuleVisual = { label: string; quip: string; art: string; alt: string };\ntype GlobalResult = { type: "Card" | "Glossary" | "Rule" | "Ruling" | "House Rule"; title: string; detail: string; view: ViewId; card?: CardEntry | null; query?: string; chapterId?: string };',
  "global result type",
);

replaceRegex(
  /const cardSearchText = \(card: CardEntry\) => .*?;\n/,
  `const HIDDEN_CARD_DETAIL_KEYS = new Set(["Favored Build Paths", "Release Set", "v2 Status", "Rules Version", "Version"]);\nconst publicCardDetails = (card: CardEntry) => Object.entries(card.details).filter(([key]) => !HIDDEN_CARD_DETAIL_KEYS.has(key));\nconst cardSearchText = (card: CardEntry) => [card.catalogId, card.name, card.cardType, card.subtype, card.category, card.deck, card.lineage, card.zone, card.timing, card.rulesText, card.flavorText, ...card.tags, ...card.buildPaths, ...Object.keys(card.stats), ...Object.values(card.stats), ...publicCardDetails(card).flatMap(([key, value]) => [key, value])].filter((value) => value !== null && value !== undefined && value !== "").join(" ").toLocaleLowerCase();\n`,
  "public card search text",
);

replaceOnce(
  '  { name: "Mr. Bobby", image: mrBobbyUrl, type: "Built Like a Filing Cabinet" },',
  '  { name: "Sentry Bobby", image: sentryBobbyUrl, type: "Built Like a Filing Cabinet" },',
  "featured Sentry Bobby",
);

replaceRegex(
  /const OFFICIAL_RULINGS = \[\n[\s\S]*?\n\];\n\nconst valueLabel/,
  `const OFFICIAL_RULINGS = [\n  ["DDB-RUL-001", "Filed Aug 27, 2026", "Boss Blitz", "Boss KO during your Yell Phase", "Finish only that player’s Ascend and Hide Phases, then transition stages. Remaining players skip their turns for that round."],\n  ["DDB-RUL-002", "Filed Aug 27, 2026", "Boss Blitz", "Boss KO outside your own Yell Phase", "If the KO occurs during a player turn, that player may complete Ascend and Hide. Otherwise, transition immediately."],\n  ["DDB-RUL-003", "Filed Aug 27, 2026", "Tempo", "Speed comparisons use current Speed", "Tempo and other Speed comparisons use current Speed after active modifiers. Printed Speed is the base value."],\n  ["DDB-RUL-004", "Filed Aug 27, 2026", "Timing", "Initiative is locked for the round", "Honor determines initiative. Later Speed changes and tagging do not reorder turns until the next Honor Phase."],\n  ["DDB-RUL-005", "Filed Aug 27, 2026", "Boss Blitz", "Player wins a Speed tie with a Boss", "When a player and Boss have the same current Speed, the player acts before the Boss."],\n  ["DDB-RUL-006", "Filed Aug 27, 2026", "Combos", "Multiple learned Combos may share a finisher", "Multiple eligible learned Combos may use the same final card or action. Resolve each payoff separately and obey every printed timing limit."],\n  ["DDB-RUL-007", "Filed Aug 27, 2026", "Co-op", "Co-op stage victory healing", "After a Boss stage victory in two-player co-op, each player heals their active fighter 8 HP."],\n  ["DDB-RUL-008", "Filed Aug 27, 2026", "Team Variant", "Shared Rank team variant", "Teammates share XP, Belt, promotion tasks, and rewards. Each player keeps normal individual initiative."],\n];\n\nconst valueLabel`,
  "official rulings",
);

replaceOnce(
  '<span className="version-pill"><span className="status-dot" /> v2.0 alpha field test</span>',
  '<span className="version-pill"><span className="status-dot" /> Field test active</span>',
  "home version pill",
);

replaceOnce(
  'function RulesView() {\n  const [selectedId, setSelectedId] = useState(ruleChapters[0]?.id ?? "");',
  'function RulesView({ initialChapterId = "" }: { initialChapterId?: string }) {\n  const [selectedId, setSelectedId] = useState(() => ruleChapters.some((chapter) => chapter.id === initialChapterId) ? initialChapterId : ruleChapters[0]?.id ?? "");',
  "rules initial chapter support",
);
replaceOnce(
  '<span className="source-badge">{ruleChapters.length} focused chapters · v2.0 alpha</span>',
  '<span className="source-badge">{ruleChapters.length} focused chapters · filed for table use</span>',
  "rules source badge",
);

replaceOnce(
  'Object.entries(card.details).filter(([key]) => key !== "Favored Build Paths" && key !== "Release Set")',
  'publicCardDetails(card)',
  "public card detail filtering",
);
replaceOnce(
  '<footer>Catalog: {card.catalogId} · Source: {card.sourceSheet} · {card.rulesVersion}</footer>',
  '<footer>Catalog: {card.catalogId} · Source: {card.sourceSheet}</footer>',
  "card modal version footer",
);
replaceOnce(
  'intro="Search the complete v2.0 Core catalog by ID, deck, type, rules text, or Focus Cost. The 500-card main pool excludes Starter, Character, and Boss-module cards."',
  'intro="Search the complete Core catalog by ID, deck, type, rules text, or Focus Cost. The 500-card main pool excludes Starter, Character, and Boss-module cards."',
  "card library version copy",
);

replaceOnce(
  'function RulingsView() {\n  const [query, setQuery] = useState("");',
  'function RulingsView({ initialQuery = "" }: { initialQuery?: string }) {\n  const [query, setQuery] = useState(initialQuery);',
  "rulings initial search",
);
replaceOnce(
  '{rulings.map(([tag, title, ruling], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{tag}</b><h3>{title}</h3><p>{ruling}</p></div><strong>Official</strong></article>)}',
  '{rulings.map(([id, filed, tag, title, ruling], index) => <article key={id}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{tag}</b><h3>{title}</h3><p>{ruling}</p></div><strong>{id} · {filed}</strong></article>)}',
  "ruling provenance display",
);

replaceOnce(
  'function HouseRulesView() {\n  const [query, setQuery] = useState("");',
  'function HouseRulesView({ initialQuery = "" }: { initialQuery?: string }) {\n  const [query, setQuery] = useState(initialQuery);',
  "house rules initial search",
);
replaceOnce(
  'const filtered = rulesData.houseRules.filter((entry) => `${entry.name} ${entry.rule}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));',
  'const filtered = rulesData.houseRules.filter((entry) => `${entry.name} ${entry.rule} ${entry.summary ?? ""} ${entry.notes ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));',
  "house rules search",
);
replaceOnce('title="Nine variants. Most guardrails attached."', 'title="Approved deviations. Questionable paperwork."', "house rules title");
replaceOnce(
  'intro="Nine approved deviations. The Department has initialed most of them. Tap any tile for exact timing and design notes."',
  'intro="Optional variants for tables that believe the official rules are merely a strong opening argument. Tap any tile for exact timing and design notes."',
  "house rules intro",
);
replaceOnce('<span>{filtered.length} variants</span>', '<span>Sanctioned shenanigans, filtered to taste.</span>', "house rules count copy");

replaceOnce(
  'intro="Every defined v2.0 rules term, separated from the rulebook for fast table lookup. Tap any tile for the full definition."',
  'intro="Every defined rules term, separated from the rulebook for fast table lookup. Tap any tile for the full definition."',
  "glossary version copy",
);
replaceOnce('eyebrow="Defined v2.0 term"', 'eyebrow="Defined term"', "glossary modal version copy");

replaceOnce(
  '  const [globalSearch, setGlobalSearch] = useState(""); const [searchedCard, setSearchedCard] = useState<CardEntry | null>(null); const [searchedTerm, setSearchedTerm] = useState("");',
  '  const [globalSearch, setGlobalSearch] = useState(""); const [searchedCard, setSearchedCard] = useState<CardEntry | null>(null); const [searchedTerm, setSearchedTerm] = useState("");\n  const [searchedRuleChapter, setSearchedRuleChapter] = useState(""); const [searchedRuling, setSearchedRuling] = useState(""); const [searchedHouseRule, setSearchedHouseRule] = useState("");',
  "global search target state",
);
replaceOnce(
  '  const goTo = (next: ViewId) => { setView(next); setMenuOpen(false); setGlobalSearch(""); window.history.pushState(null, "", `#${next}`); window.scrollTo({ top: 0, behavior: "smooth" }); };',
  '  const goTo = (next: ViewId) => { setSearchedCard(null); setSearchedTerm(""); setSearchedRuleChapter(""); setSearchedRuling(""); setSearchedHouseRule(""); setView(next); setMenuOpen(false); setGlobalSearch(""); window.history.pushState(null, "", `#${next}`); window.scrollTo({ top: 0, behavior: "smooth" }); };',
  "navigation search reset",
);
replaceRegex(
  /  const globalResults = useMemo\(\(\) => \{[\s\S]*?\n  const chooseResult = .*?;\n/,
  `  const globalResults: GlobalResult[] = useMemo(() => {\n    const term = globalSearch.trim().toLocaleLowerCase(); if (term.length < 2) return [];\n    const rules: GlobalResult[] = ruleChapters.flatMap((chapter): GlobalResult[] => {\n      if (!JSON.stringify(chapter).toLocaleLowerCase().includes(term)) return [];\n      const section = chapter.sections.find((entry) => JSON.stringify(entry).toLocaleLowerCase().includes(term));\n      return [{ type: "Rule", title: chapter.title, detail: section ? \`Chapter \${displayRuleNumber(chapter)} · \${section.title}\` : \`Chapter \${displayRuleNumber(chapter)} · overview\`, view: "rules", chapterId: chapter.id }];\n    }).slice(0, 3);\n    const rulings: GlobalResult[] = OFFICIAL_RULINGS.filter((entry) => entry.join(" ").toLocaleLowerCase().includes(term)).slice(0, 2).map(([id, filed, tag, title]) => ({ type: "Ruling", title, detail: \`\${id} · \${tag} · \${filed}\`, view: "rulings", query: title }));\n    const cards: GlobalResult[] = cardData.cards.filter((card) => cardSearchText(card).includes(term)).slice(0, 3).map((card) => ({ type: "Card", title: card.name, detail: \`\${card.cardType} · \${card.subtype}\`, view: "cards", card }));\n    const terms: GlobalResult[] = rulesData.glossary.filter((entry) => \`\${entry.term} \${entry.meaning}\`.toLocaleLowerCase().includes(term)).slice(0, 2).map((entry) => ({ type: "Glossary", title: entry.term, detail: entry.meaning, view: "glossary", query: entry.term }));\n    const houseRules: GlobalResult[] = rulesData.houseRules.filter((entry) => \`\${entry.name} \${entry.rule} \${entry.summary ?? ""} \${entry.notes ?? ""}\`.toLocaleLowerCase().includes(term)).slice(0, 2).map((entry) => ({ type: "House Rule", title: entry.name, detail: entry.summary || entry.rule, view: "house-rules", query: entry.name }));\n    return [...rules, ...rulings, ...cards, ...terms, ...houseRules].slice(0, 10);\n  }, [globalSearch]);\n  const chooseResult = (result: GlobalResult) => {\n    goTo(result.view);\n    if (result.card) setSearchedCard(result.card);\n    if (result.view === "glossary") setSearchedTerm(result.query ?? result.title);\n    if (result.view === "rules") setSearchedRuleChapter(result.chapterId ?? "");\n    if (result.view === "rulings") setSearchedRuling(result.query ?? result.title);\n    if (result.view === "house-rules") setSearchedHouseRule(result.query ?? result.title);\n  };\n`,
  "unified global search",
);

app = app.replaceAll('placeholder="Search cards & terms"', 'placeholder="Search the dojo"');
app = app.replaceAll('aria-label="Search cards and glossary"', 'aria-label="Search cards, rules, rulings, glossary, and house rules"');

replaceOnce(
  '<div key={view} className="view-stage">{view === "home" && <HomeView goTo={goTo} />}{view === "quickstart" && <QuickStartView goTo={goTo} />}{view === "story" && <StoryView goTo={goTo} />}{view === "rules" && <RulesView />}{view === "cards" && <CardsView initialCard={searchedCard} clearInitialCard={() => setSearchedCard(null)} />}{view === "rulings" && <RulingsView />}{view === "glossary" && <GlossaryView key={searchedTerm} initialQuery={searchedTerm} />}{view === "house-rules" && <HouseRulesView />}</div>',
  '<div key={view} className="view-stage">{view === "home" && <HomeView goTo={goTo} />}{view === "quickstart" && <QuickStartView goTo={goTo} />}{view === "story" && <StoryView goTo={goTo} />}{view === "rules" && <RulesView key={searchedRuleChapter || "rules"} initialChapterId={searchedRuleChapter} />}{view === "cards" && <CardsView initialCard={searchedCard} clearInitialCard={() => setSearchedCard(null)} />}{view === "rulings" && <RulingsView key={searchedRuling || "rulings"} initialQuery={searchedRuling} />}{view === "glossary" && <GlossaryView key={searchedTerm || "glossary"} initialQuery={searchedTerm} />}{view === "house-rules" && <HouseRulesView key={searchedHouseRule || "house-rules"} initialQuery={searchedHouseRule} />}</div>',
  "search-aware view routing",
);
replaceOnce(
  '<span>Rules source: v2.0 alpha field test</span>',
  '<span>Filed with the Department. Probably correctly.</span>',
  "footer version copy",
);

for (const forbidden of ["v2.0 alpha field test", "complete v2.0 Core catalog", "Every defined v2.0 rules term", "Defined v2.0 term", "Rules source: v2.0"]) {
  if (app.includes(forbidden)) throw new Error(`Public version copy still present: ${forbidden}`);
}
if (app.includes('name: "Mr. Bobby"')) throw new Error("Mr. Bobby is still in the featured roster");

await writeFile(appPath, app);

const rulesData = JSON.parse(await readFile(rulesPath, "utf8"));
const seenGlossaryTerms = new Set();
rulesData.glossary = rulesData.glossary.filter((entry) => {
  const key = entry.term.trim().toLocaleLowerCase();
  if (seenGlossaryTerms.has(key)) return false;
  seenGlossaryTerms.add(key);
  return true;
});
if ("version" in rulesData) rulesData.version = "Official Rules";
if ("source" in rulesData) rulesData.source = "Dojo Deckbuilder Paper-Fu field-test rules";
await writeFile(rulesPath, `${JSON.stringify(rulesData, null, 2)}\n`);

const mobileTest = `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst cssUrl = new URL("../app/globals.css", import.meta.url);\nconst appUrl = new URL("../app/companion-app.tsx", import.meta.url);\n\ntest("ships the phone and small-tablet responsive contract", async () => {\n  const css = await readFile(cssUrl, "utf8");\n  for (const expected of [\n    "@media (max-width: 840px)",\n    "@media (max-width: 520px)",\n    "env(safe-area-inset-bottom)",\n    "100dvh",\n    ".mobile-chapter-picker",\n    'content: "Swipe table →"',\n    ".library-search-control",\n    ".combat-term",\n    ".modal-backdrop",\n    "@media (hover: none), (pointer: coarse)",\n  ]) assert.ok(css.includes(expected), \`Missing responsive contract: \${expected}\`);\n});\n\ntest("mobile navigation reaches every section without crowding the bottom bar", async () => {\n  const app = await readFile(appUrl, "utf8");\n  assert.match(app, /aria-label="Mobile navigation"/);\n  for (const label of [">Home<", ">Start<", ">Rules<", ">Cards<", ">Menu<"]) {\n    assert.ok(app.includes(label), \`Missing mobile destination: \${label}\`);\n  }\n  assert.match(app, /id="mobile-menu"/);\n  assert.match(app, /aria-controls="mobile-menu"/);\n  assert.match(app, /view === "house-rules"/);\n});\n\ntest("mobile overlays lock background scroll and rules expose a compact chapter picker", async () => {\n  const app = await readFile(appUrl, "utf8");\n  assert.match(app, /document\\.body\\.style\\.overflow = "hidden"/);\n  assert.match(app, /className="mobile-chapter-picker"/);\n  assert.match(app, /id="rule-reader"/);\n  assert.match(app, /loading="lazy"/);\n});\n`;
await writeFile("tests/mobile-responsive.test.mjs", mobileTest);

const renderedTest = `import assert from "node:assert/strict";\nimport { readFile, readdir } from "node:fs/promises";\nimport test from "node:test";\n\ntest("renders the static GitHub Pages shell with mobile metadata", async () => {\n  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");\n  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\\.0" \\/>/);\n  assert.match(html, /<div id="root"><\\/div>/);\n  assert.match(html, /\\/dojo-deckbuilder\\/assets\\/index-[^"']+\\.js/);\n});\n\ntest("bundles the interactive Starter Deck lesson and both card examples", async () => {\n  const assetDirectory = new URL("../dist/assets/", import.meta.url);\n  const bundles = (await readdir(assetDirectory)).filter((name) => /^index-.*\\.js$/.test(name));\n  assert.equal(bundles.length, 1);\n  const bundle = await readFile(new URL(bundles[0], assetDirectory), "utf8");\n  for (const expected of ["Build this exact 15-card deck.", "Basic Jab", "High Guard", "Attacks", "Defenses", "Katas", "Junk", "Rita attacks Devin. Count the paper."]) {\n    assert.ok(bundle.includes(expected), \`Missing companion lesson content: \${expected}\`);\n  }\n  assert.equal(bundle.match(/data:image\\/webp;base64,/g)?.length ?? 0, 0, "Artwork should remain separately cacheable.");\n});\n\ntest("public companion copy is version-free and uses the current featured roster", async () => {\n  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");\n  for (const forbidden of ["v2.0 alpha field test", "complete v2.0 Core catalog", "Every defined v2.0 rules term", "Defined v2.0 term", "Rules source: v2.0"]) {\n    assert.ok(!source.includes(forbidden), \`Public version label survived: \${forbidden}\`);\n  }\n  assert.ok(source.includes("Field test active"));\n  assert.ok(source.includes('name: "Sentry Bobby"'));\n  assert.ok(!source.includes('name: "Mr. Bobby"'));\n  assert.ok(source.includes("publicCardDetails(card)"));\n});\n\ntest("global search spans the whole companion", async () => {\n  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");\n  for (const expected of ['type: "Rule"', 'type: "Ruling"', 'type: "Card"', 'type: "Glossary"', 'type: "House Rule"', 'placeholder="Search the dojo"']) {\n    assert.ok(source.includes(expected), \`Missing unified search behavior: \${expected}\`);\n  }\n});\n`;
await writeFile("tests/rendered-html.test.mjs", renderedTest);

const integrityTest = `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\ntest("glossary terms are unique", async () => {\n  const rules = JSON.parse(await readFile(new URL("../app/data/rules.json", import.meta.url), "utf8"));\n  const normalized = rules.glossary.map((entry) => entry.term.trim().toLocaleLowerCase());\n  assert.equal(new Set(normalized).size, normalized.length, "Glossary contains duplicate terms");\n  for (const term of ["Belt Exam", "Boss Profile", "Ready", "Reversal"]) {\n    assert.equal(rules.glossary.filter((entry) => entry.term === term).length, 1, \`Expected one glossary entry for \${term}\`);\n  }\n});\n\ntest("deployment gates publication on the test suite", async () => {\n  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");\n  assert.match(workflow, /run: npm test/);\n});\n\ntest("rulings have stable IDs and filing dates", async () => {\n  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");\n  for (let number = 1; number <= 8; number += 1) {\n    assert.ok(source.includes(\`DDB-RUL-\${String(number).padStart(3, "0")}\`));\n  }\n  assert.ok(source.includes("Filed Aug 27, 2026"));\n});\n`;
await writeFile("tests/content-integrity.test.mjs", integrityTest);

let deploy = await readFile(deployPath, "utf8");
if (deploy.includes("- name: Build static site\n        run: npm run build")) {
  deploy = deploy.replace("- name: Build static site\n        run: npm run build", "- name: Test and build static site\n        run: npm test");
}
if (!deploy.includes("run: npm test")) throw new Error("Deployment workflow does not run npm test");
await writeFile(deployPath, deploy);

console.log("Targeted Dojo Deckbuilder site fixes applied.");
