from pathlib import Path

app_path = Path("app/companion-app.tsx")
app = app_path.read_text()

replacements = [
    (
        'import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
        'import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
    ),
    (
        'import rulesJson from "./data/rules.json";\nimport PlaytestView from "./playtest";',
        'import rulesJson from "./data/rules.json";\n\nconst PlaytestView = lazy(() => import("./playtest"));',
    ),
    (
        '<div className={`card-art${isCompleteCardArt(card) ? " card-art--complete" : ""}`}><img src={cardImageUrl(card)} alt={hasCardArt(card) ? card.name : "Temporary Dojo Deckbuilder card artwork placeholder"} loading="lazy" decoding="async" /><span>{card.catalogId}</span></div>',
        '<div className={`card-art${isCompleteCardArt(card) ? " card-art--complete" : ""}${!hasCardArt(card) ? " card-art--pending" : ""}`}><img src={cardImageUrl(card)} alt={hasCardArt(card) ? card.name : `Artwork pending for ${card.name}`} loading="lazy" decoding="async" /><span>{card.catalogId}</span></div>',
    ),
    (
        '{view === "playtest" && <PlaytestView goTo={goTo} />}',
        '{view === "playtest" && <Suspense fallback={<main className="playtest-loading shell"><span className="eyebrow">Field Test</span><h1>Preparing the mat…</h1><p>The Department is locating the correct clipboard.</p></main>}><PlaytestView goTo={goTo} /></Suspense>}',
    ),
]
for old, new in replacements:
    if old not in app:
        raise SystemExit(f"Missing batch-two source fragment: {old[:120]}")
    app = app.replace(old, new, 1)
app_path.write_text(app)

css_path = Path("app/globals.css")
css = css_path.read_text()
addition = r'''

/* Intentional unfinished-art state and lazy field-test handoff. */
.card-art--pending { position: relative; }
.card-art--pending img { opacity: .42; filter: saturate(.45) contrast(.9); }
.card-art--pending::after {
  content: "ARTWORK PENDING · FORM 37-B";
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(82%, 230px);
  transform: translate(-50%, -50%) rotate(-4deg);
  border: 2px solid var(--red);
  padding: 9px 12px;
  color: var(--red-dark);
  background: color-mix(in srgb, var(--paper-light) 92%, transparent);
  box-shadow: 3px 4px 0 rgba(23,33,29,.16);
  font-family: var(--display);
  font-size: 11px;
  line-height: 1.1;
  font-weight: 900;
  letter-spacing: .08em;
  text-align: center;
}
:root[data-theme="dark"] .card-art--pending::after {
  color: #ffb29f;
  border-color: #e8745f;
  background: rgba(31,48,39,.94);
}
.playtest-loading {
  min-height: min(72dvh, 760px);
  display: grid;
  align-content: center;
  justify-items: center;
  padding-block: 80px;
  text-align: center;
}
.playtest-loading h1 { margin: 0; font-family: var(--display); font-size: clamp(42px, 7vw, 76px); }
.playtest-loading p { color: var(--ink-soft); }
'''
if "ARTWORK PENDING · FORM 37-B" not in css:
    css += addition
css_path.write_text(css)

test_path = Path("tests/rendered-html.test.mjs")
tests = test_path.read_text()
regression = r'''

test("Quick Duel is code-split and missing artwork is presented intentionally", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /const PlaytestView = lazy\(\(\) => import\("\.\/playtest"\)\)/);
  assert.match(source, /<Suspense fallback=/);
  assert.doesNotMatch(source, /import PlaytestView from "\.\/playtest"/);
  assert.match(source, /card-art--pending/);
  assert.match(css, /ARTWORK PENDING · FORM 37-B/);
});
'''
if "Quick Duel is code-split and missing artwork is presented intentionally" not in tests:
    tests += regression
test_path.write_text(tests)
