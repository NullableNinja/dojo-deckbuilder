import assert from "node:assert/strict";
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
  assert.match(source, /import PlaytestView from "\.\/playtest"/);
  assert.doesNotMatch(source, /const PlaytestView = lazy/);
});
