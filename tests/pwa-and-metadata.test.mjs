import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("publishes installable companion metadata and social discovery tags", async () => {
  const [html, manifest] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);
  assert.match(html, /rel="manifest" href="%BASE_URL%manifest\.webmanifest"/);
  assert.match(html, /rel="canonical" href="https:\/\/nullableninja\.github\.io\/dojo-deckbuilder\/"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /application\/ld\+json/);
  assert.equal(JSON.parse(manifest).display, "standalone");
});

test("registers an offline companion service worker without caching live revision checks", async () => {
  const [entry, worker] = await Promise.all([
    readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  assert.match(entry, /navigator\.serviceWorker\.register/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /build\.json/);
  assert.match(worker, /rules-manifest\.json/);
});
