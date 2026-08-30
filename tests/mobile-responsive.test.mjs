import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssUrl = new URL("../app/globals.css", import.meta.url);
const appUrl = new URL("../app/companion-app.tsx", import.meta.url);

test("ships the phone and small-tablet responsive contract", async () => {
  const css = await readFile(cssUrl, "utf8");
  for (const expected of [
    "@media (max-width: 840px)",
    "@media (max-width: 520px)",
    "env(safe-area-inset-bottom)",
    "100dvh",
    ".mobile-chapter-picker",
    'content: "Swipe table →"',
    ".library-search-control",
    ".combat-term",
    ".modal-backdrop",
    "@media (hover: none), (pointer: coarse)",
  ]) assert.ok(css.includes(expected), `Missing responsive contract: ${expected}`);
});

test("mobile navigation reaches every section without crowding the bottom bar", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /aria-label="Mobile navigation"/);
  for (const label of [">Home<", ">Start<", ">Rules<", ">Cards<", ">Menu<"]) {
    assert.ok(app.includes(label), `Missing mobile destination: ${label}`);
  }
  assert.match(app, /id="mobile-menu"/);
  assert.match(app, /aria-controls="mobile-menu"/);
  assert.match(app, /view === "house-rules"/);
});

test("mobile overlays lock background scroll and rules expose a compact chapter picker", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /document\.body\.style\.overflow = "hidden"/);
  assert.match(app, /className="mobile-chapter-picker"/);
  assert.match(app, /id="rule-reader"/);
  assert.match(app, /loading="lazy"/);
});

test("card viewer preserves the library position and navigates the filtered results", async () => {
  const [app, css] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);
  assert.match(app, /body\.style\.overflow = "hidden"/);
  assert.doesNotMatch(app, /body\.style\.position = "fixed"/);
  assert.doesNotMatch(app, /body\.style\.top = `-\$\{scrollY\}px`/);
  assert.match(app, /window\.scrollTo\(scrollX, scrollY\)/);
  assert.match(app, /focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /event\.key === "ArrowLeft"/);
  assert.match(app, /event\.key === "ArrowRight"/);
  assert.match(app, /aria-label="Browse filtered cards"/);
  assert.match(app, /import \{ createPortal \} from "react-dom"/);
  assert.match(app, /return createPortal\(<div className="modal-backdrop"[\s\S]*document\.body\)/);
  assert.match(app, /previousCard=\{previousCard\}/);
  assert.match(app, /nextCard=\{nextCard\}/);
  assert.match(css, /\.card-modal-nav/);
  assert.match(css, /\.modal-backdrop \{ position: fixed; inset: 0;/);
  assert.match(css, /overscroll-behavior: contain/);
});

test("card and detail modals provide dark-theme surfaces for light-theme controls", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /:root\[data-theme="dark"\] \.card-modal-nav > button \{[\s\S]*?background: #24342a;/);
  assert.match(css, /:root\[data-theme="dark"\] \.card-modal-nav > button:hover:not\(:disabled\) \{[\s\S]*?background: #30483a;/);
  assert.match(css, /:root\[data-theme="dark"\] \.card-modal-position \{[\s\S]*?color: #d5e2d9;[\s\S]*?background: #2c4034;/);
  assert.match(css, /:root\[data-theme="dark"\] \.modal-win,[\s\S]*?\.modal-design-note \{ background: #24342a; \}/);
});
