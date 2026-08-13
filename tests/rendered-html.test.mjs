import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders homepage artwork without external image requests", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test-images", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  const html = await response.text();
  const embeddedWebpImages = html.match(/data:image\/webp;base64,/g)?.length ?? 0;
  const externalWebpImages = html.match(/(?:src|href)=["']\/[^"']+\.webp/g)?.length ?? 0;

  assert.equal(response.status, 200);
  assert.ok(embeddedWebpImages >= 7, `Expected embedded homepage artwork; found ${embeddedWebpImages} images.`);
  assert.equal(externalWebpImages, 0);
});

test("bundles the interactive Starter Deck lesson and both card examples", async () => {
  const assetDirectory = new URL("../dist/client/assets/", import.meta.url);
  const companionBundles = (await readdir(assetDirectory)).filter((name) => /^companion-app-.*\.js$/.test(name));
  assert.equal(companionBundles.length, 1);

  const bundle = await readFile(new URL(companionBundles[0], assetDirectory), "utf8");
  for (const expected of ["Build this exact 15-card deck.", "Basic Jab", "High Guard", "Attacks", "Defenses", "Katas", "Junk"]) {
    assert.ok(bundle.includes(expected), `Missing Starter Deck lesson content: ${expected}`);
  }

  const embeddedWebpImages = bundle.match(/data:image\/webp;base64,/g)?.length ?? 0;
  assert.ok(embeddedWebpImages >= 17, `Expected Starter Deck artwork to be embedded; found ${embeddedWebpImages} images.`);
});

test("bundles the interactive worked combat example", async () => {
  const assetDirectory = new URL("../dist/client/assets/", import.meta.url);
  const companionBundles = (await readdir(assetDirectory)).filter((name) => /^companion-app-.*\.js$/.test(name));
  assert.equal(companionBundles.length, 1);

  const bundle = await readFile(new URL(companionBundles[0], assetDirectory), "utf8");
  for (const expected of ["Rita attacks Devin. Count the paper.", "Wild Swing", "Desperate Cover", "Remove Devin’s Defense", "Devin loses 0 HP.", "Devin loses "]) {
    assert.ok(bundle.includes(expected), `Missing worked combat content: ${expected}`);
  }
});

test("defaults the Card Library to Core Game with balanced controls", async () => {
  const source = await readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8");
  assert.match(source, /useState\(CORE_EXPANSION\)/);
  assert.match(source, /setExpansion\(CORE_EXPANSION\)/);
  assert.match(source, /library-search-control/);
  assert.match(source, /cardsInScope\.length/);
});
