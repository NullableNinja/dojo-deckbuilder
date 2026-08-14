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
  for (const label of [">Home<", ">Start<", ">Rules<", ">Cards<", ">More<"]) {
    assert.ok(app.includes(label), `Missing mobile destination: ${label}`);
  }
  assert.match(app, /id="primary-navigation"/);
  assert.match(app, /aria-controls="primary-navigation"/);
  assert.match(app, /view === "house-rules"/);
});

test("mobile overlays lock background scroll and rules expose a compact chapter picker", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /document\.body\.style\.overflow = "hidden"/);
  assert.match(app, /className="mobile-chapter-picker"/);
  assert.match(app, /id="rule-reader"/);
  assert.match(app, /loading="lazy"/);
});
