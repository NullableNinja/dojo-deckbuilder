import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("card effect automation audit is generated from the live catalog", async () => {
  const report = JSON.parse(await readFile(new URL("../reports/card-effect-audit.json", import.meta.url), "utf8"));
  assert.ok(report.catalog_cards_with_rules >= 500);
  assert.ok(report.coverage.full >= 1);
  assert.ok(report.coverage.queued >= 1);
  assert.ok(Array.isArray(report.top_unsupported_patterns));
});
