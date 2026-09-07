import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("service worker rotates the companion cache and does not runtime-cache Vite bundles", () => {
  assert.match(serviceWorker, /CACHE_NAME = "dojo-deckbuilder-companion-v3"/);
  assert.match(serviceWorker, /CACHE_PREFIX = "dojo-deckbuilder-companion-"/);
  assert.match(serviceWorker, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/);
  assert.match(serviceWorker, /isBundledAsset = url\.pathname\.startsWith\(`\$\{scopeUrl\.pathname\}assets\/`\)/);
  assert.match(serviceWorker, /if \(isBundledAsset\) \{[\s\S]{0,120}event\.respondWith\(fetch\(request\)\)/);
});

test("client requests fresh service-worker code and reloads after controller replacement", () => {
  assert.match(main, /register\(`\$\{import\.meta\.env\.BASE_URL\}sw\.js`, \{ updateViaCache: "none" \}\)/);
  assert.match(main, /\.then\(\(registration\) => registration\.update\(\)\)/);
  assert.match(main, /addEventListener\("controllerchange"/);
  assert.match(main, /window\.location\.reload\(\)/);
});
