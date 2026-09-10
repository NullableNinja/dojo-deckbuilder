import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("reference desk stays generated-data backed and has a stable render boundary", async () => {
  const [desk, app] = await Promise.all([
    readFile(new URL("../app/reference-desk.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of ["./data/cards.json", "./data/rules.json", "./data/effects.json", "./data/card-effects.json"]) assert.match(desk, new RegExp(source.replaceAll(".", "\\.").replaceAll("/", "\\/")));
  assert.match(app, /import PlaytestView from "\.\/playtest";/);
  assert.match(app, /import \{ ReferenceDesk \} from "\.\/reference-desk";/);
  assert.match(app, /id: "reference", label: "Reference Desk"/);
});
