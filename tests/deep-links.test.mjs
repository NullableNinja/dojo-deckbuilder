import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRoute, serializeRoute } from "../app/routing.ts";

test("companion supports shareable deep links for rules and cards", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/companion-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.deepEqual(parseRoute("#cards/DDB-ATK-CORE-001"), { page: "cards", cardId: "DDB-ATK-CORE-001" });
  assert.deepEqual(parseRoute("#rules/08-combat/defense-limits"), { page: "rules", chapterId: "08-combat", sectionId: "defense-limits" });
  assert.equal(serializeRoute({ page: "cards", cardId: "DDB-ATK-CORE-001" }), "#cards/DDB-ATK-CORE-001");
  assert.equal(serializeRoute({ page: "rules", chapterId: "08-combat", sectionId: "defense-limits" }), "#rules/08-combat/defense-limits");

  // Preserve public compatibility with links issued before the unified router.
  assert.deepEqual(parseRoute("#card/DDB-DEF-CORE-002"), { page: "cards", cardId: "DDB-DEF-CORE-002" });
  assert.deepEqual(parseRoute("#house-rules/Training%20Montage"), { page: "rulings", tab: "house", query: "Training Montage" });

  assert.match(source, /navigate\(\{ page: "rules", chapterId: selected\.id, sectionId: id \}\)/);
  assert.match(source, /initialSectionId/);
  assert.match(source, /className="rule-section-nav"/);
  assert.match(css, /Shareable rule-section navigation/);
  assert.match(source, /import PlaytestView from "\.\/playtest";/);
  assert.doesNotMatch(source, /const dojoHash =/);
  assert.doesNotMatch(source, /const parseDojoHash =/);
});
