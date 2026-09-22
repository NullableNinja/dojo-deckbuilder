import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { certifyPlaytest } from "../scripts/playtest-certification.mjs";

const playtestCss = readFileSync(new URL("../app/playtest.css", import.meta.url), "utf8");

test("Playtest certifies every catalog card through canonical structured execution", async () => {
  const report = await certifyPlaytest();
  assert.deepEqual(report.failures, []);
  assert.equal(report.catalogCards, report.registeredCards);
  assert.equal(report.catalogCards, report.fullyPlannedCards);
  assert.equal(report.structuredEffects, report.supportedEffects);
  assert.equal(report.unsupportedEffects, 0);
  assert.equal(report.emptyCanonicalEntries, report.emptyStarterEntries);
  assert.equal(report.unsupportedCombos.length, 0);
});

test("hand Inspect controls stay above the hovered card face", () => {
  assert.match(
    playtestCss,
    /\.playtest-shell--live \.play-card-inspect \{[\s\S]*?z-index: calc\(var\(--layer-floating\) \+ 1\);/,
  );
});
